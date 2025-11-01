package mytypes

type APIHandlerResp struct {
	TransactionId string `json:"transactionID"`
	ApiVersion    string `json:"apiVersion"`
	Data          any    `json:"data"`
}
