package mys3

import (
	"context"
	"io"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/stretchr/testify/assert"
)

// MockS3Service is a mock implementation of the S3Service interface.
type MockS3Service struct {
	ListBucketsFunc  func(ctx context.Context) ([]types.Bucket, error)
	CreateBucketFunc func(ctx context.Context, name, region string, objectLockEnabled bool) error
	UploadFunc       func(ctx context.Context, bucketName, objectKey string, body io.Reader) (*manager.UploadOutput, error)
}

func (m *MockS3Service) ListBuckets(ctx context.Context) ([]types.Bucket, error) {
	return m.ListBucketsFunc(ctx)
}

func (m *MockS3Service) CreateBucket(ctx context.Context, name, region string, objectLockEnabled bool) error {
	return m.CreateBucketFunc(ctx, name, region, objectLockEnabled)
}

func (m *MockS3Service) Upload(ctx context.Context, bucketName, objectKey string, body io.Reader) (*manager.UploadOutput, error) {
	return m.UploadFunc(ctx, bucketName, objectKey, body)
}

// TestMyImageUploadHandler is an example of testing a handler that uses the S3 client.
func TestMyImageUploadHandler(t *testing.T) {
	mockS3 := &MockS3Service{}

	// Define the behavior of the mock's Upload function for this test case
	mockS3.UploadFunc = func(ctx context.Context, bucketName, objectKey string, body io.Reader) (*manager.UploadOutput, error) {
		assert.Equal(t, "my-test-bucket", bucketName)
		assert.Equal(t, "my-image.jpg", objectKey)

		// You can read the body to check its content if needed
		content, _ := io.ReadAll(body)
		assert.Equal(t, "fake-image-data", string(content))

		return &manager.UploadOutput{
			Location: "https://my-test-bucket.s3.amazonaws.com/my-image.jpg",
		}, nil
	}

	// Now, inject the mock into the component you are testing
	// For example, a handler that takes the S3Service as a dependency
	// myHandler := NewImageHandler(mockS3)

	// Simulate the upload
	reader := strings.NewReader("fake-image-data")
	result, err := mockS3.Upload(context.Background(), "my-test-bucket", "my-image.jpg", reader)

	// Assert the results
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, "https://my-test-bucket.s3.amazonaws.com/my-image.jpg", result.Location)
}
