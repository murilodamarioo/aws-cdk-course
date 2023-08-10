import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda'
import { ApiGatewayManagementApi, DynamoDB } from 'aws-sdk'
import * as AWSXRay from 'aws-xray-sdk'
import { InvoiceTransactionRepository, InvoiceTransactionStatus } from '/opt/nodejs/invoiceTransaction'
import { InvoiceWSService } from '/opt/nodejs/invoiceWSConnection'

AWSXRay.captureAWS(require('aws-sdk'))

const invoicesDdb = process.env.INVOICE_DDB!
const invoicesWSApiEndPoint = process.env.INVOICE_WSAPI_ENDPOINT!.substring(6)

const dynamoDbClient = new DynamoDB.DocumentClient()
const  apigwManagementApi = new ApiGatewayManagementApi({
    endpoint: invoicesWSApiEndPoint
})

const invoiceTransactionRepository = new InvoiceTransactionRepository(dynamoDbClient, invoicesDdb)
const invoiceWSService = new InvoiceWSService(apigwManagementApi)

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    const transactionId = JSON.parse(event.body!).transactionId as string
    const lambdaRequestId = context.awsRequestId
    const connectionId = event.requestContext.connectionId!

    console.log(`ConnectionId: ${connectionId} - Lambda RequestI: ${lambdaRequestId}`)
    
    try {
        const invoiceTransaction = await invoiceTransactionRepository.getInvoiceTransaction(transactionId)

        if (invoiceTransaction.transactionsStatus === InvoiceTransactionStatus.GENERATED) {
            await Promise.all([invoiceWSService.sendInvoiceStatus(transactionId, connectionId, InvoiceTransactionStatus.CANCELLED),
            invoiceTransactionRepository.updateInvoiceTransaction(transactionId, InvoiceTransactionStatus.CANCELLED)])
        } else {
            await invoiceWSService.sendInvoiceStatus(transactionId, connectionId, invoiceTransaction.transactionsStatus)
            console.log(`Can't cancel an ongoing process`)
        }
    } catch (error) {
        console.error((<Error>error).message)
        console.error(`Invoice transaction not found - TransactionId: ${transactionId}`)
        await invoiceWSService.sendInvoiceStatus(transactionId, connectionId, InvoiceTransactionStatus.NOT_FOUND)
    }
    return {
        statusCode:200,
        body: 'OK'
    }
}