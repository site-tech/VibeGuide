package mys3

import (
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// S3Service defines the interface for our S3 client operations.
// Using an interface allows for easy mocking in unit tests.
type S3Service interface {
	ListBuckets(ctx context.Context) ([]types.Bucket, error)
	CreateBucket(ctx context.Context, name, region string, objectLockEnabled bool) error
	Upload(ctx context.Context, bucketName, objectKey string, body io.Reader) (*manager.UploadOutput, error)
}

// Service is the concrete implementation of the S3Service interface.
type Service struct {
	client   *s3.Client
	uploader *manager.Uploader
}

// var _ S3Service = (*Service)(nil) ensures that Service struct implements the S3Service interface at compile time.
var _ S3Service = (*Service)(nil)

// New creates a new S3 Service client.
// It expects an AWS config object and returns an implementation of S3Service.
func New(cfg aws.Config) *Service {
	s3Client := s3.NewFromConfig(cfg)
	return &Service{
		client:   s3Client,
		uploader: manager.NewUploader(s3Client),
	}
}

// NewWithDefaultConfig creates a new S3 Service client using the default AWS config
// loaded from the environment (credentials file, env vars, etc.).
func NewWithDefaultConfig(ctx context.Context) (*Service, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to load default aws config: %w", err)
	}
	return New(cfg), nil
}

// ListBuckets lists the buckets in the current account.
func (s *Service) ListBuckets(ctx context.Context) ([]types.Bucket, error) {
	var buckets []types.Bucket

	paginator := s3.NewListBucketsPaginator(s.client, &s3.ListBucketsInput{})
	for paginator.HasMorePages() {
		output, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to list buckets: %w", err)
		}
		buckets = append(buckets, output.Buckets...)
	}

	return buckets, nil
}

// CreateBucket creates a bucket with the specified name in the specified Region.
// It waits for the bucket to become available before returning.
func (s *Service) CreateBucket(ctx context.Context, name, region string, objectLockEnabled bool) error {
	input := &s3.CreateBucketInput{
		Bucket: aws.String(name),
		CreateBucketConfiguration: &types.CreateBucketConfiguration{
			LocationConstraint: types.BucketLocationConstraint(region),
		},
	}

	if objectLockEnabled {
		input.ObjectLockEnabledForBucket = aws.Bool(true)
	}

	_, err := s.client.CreateBucket(ctx, input)
	if err != nil {
		// It's safe to ignore "already exists" or "owned by you" errors.
		var alreadyOwned *types.BucketAlreadyOwnedByYou
		var alreadyExists *types.BucketAlreadyExists
		if !errors.As(err, &alreadyOwned) && !errors.As(err, &alreadyExists) {
			return fmt.Errorf("failed to create bucket %s: %w", name, err)
		}
	}

	// Wait for the bucket to exist. This is useful to avoid race conditions.
	waiter := s3.NewBucketExistsWaiter(s.client)
	if err := waiter.Wait(ctx, &s3.HeadBucketInput{Bucket: aws.String(name)}, 2*time.Minute); err != nil {
		return fmt.Errorf("timed out waiting for bucket %s to exist: %w", name, err)
	}

	return nil
}

// Upload reads from an io.Reader and puts the data into an object in a bucket.
// It uses the S3 Upload Manager to automatically handle multipart uploads.
func (s *Service) Upload(ctx context.Context, bucketName, objectKey string, body io.Reader) (*manager.UploadOutput, error) {
	output, err := s.uploader.Upload(ctx, &s3.PutObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(objectKey),
		Body:   body,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to upload object %s to bucket %s: %w", objectKey, bucketName, err)
	}

	// Wait for the object to exist after upload for strong read-after-write consistency.
	waiter := s3.NewObjectExistsWaiter(s.client)
	if err := waiter.Wait(ctx, &s3.HeadObjectInput{Bucket: aws.String(bucketName), Key: aws.String(objectKey)}, 2*time.Minute); err != nil {
		return nil, fmt.Errorf("timed out waiting for object %s to exist in bucket %s: %w", objectKey, bucketName, err)
	}

	return output, nil
}
