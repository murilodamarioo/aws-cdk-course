import { AttributeValue, Context, DynamoDBStreamEvent } from 'aws-lambda'
import { ApiGatewayManagementApi, DynamoDB, EventBridge } from 'aws-sdk'
import { InvoiceWSService } from '/opt/nodejs/invoiceWSConnection'
import * as AWSXRay from 'aws-xray-sdk'

AWSXRay.captureAWS(require('aws-sdk'))

const eventsDdb = process.env.EVENTS_DDB!
const auditBusName = process.env.AUDIT_BUS_NAME!
const invoiceWSApiEndPoint = process.env.INVOICE_WSAPI_END_POINT!.substring(6)

const dynamoDbClient = new DynamoDB.DocumentClient()
const eventBrigdeClient = new EventBridge()
const apigwManagementApi = new ApiGatewayManagementApi({
    endpoint: invoiceWSApiEndPoint
})

const invoiceWSService = new InvoiceWSService(apigwManagementApi)

export async function handler(event: DynamoDBStreamEvent, context: Context): Promise<void> {
    const promises: Promise<void>[] = []

    event.Records.forEach((record) => {
        if (record.eventName === 'INSERT') {
            if (record.dynamodb!.NewImage!.pk.S!.startsWith('#transaction')) {
                console.log('Invoice transaction event received')
            } else {
                console.log('invoice event received')
                promises.push(createEvent(record.dynamodb!.NewImage!, 'INVOICE_CREATED'))
            }
        } else if (record.eventName === 'MODIFY') {

        } else if (record.eventName === 'REMOVE') {
            if(record.dynamodb!.OldImage!.pk.S === '#transaction') {
                console.log('Invoice transaction event received')
                promises.push(processExpiredTransaction(record.dynamodb!.OldImage!))
            }
        }
    })

    await Promise.all(promises)

    return
}

async function processExpiredTransaction(invoiceTransactionImage: {[key: string]: AttributeValue}): Promise<void> {
    const transactionId = invoiceTransactionImage.sk.S!
    const connectionId = invoiceTransactionImage.connectionId.S!

    console.log(`TransactionId: ${transactionId} - ConnectionId: ${connectionId}`)

    if (invoiceTransactionImage.transactionStatus.S === 'INVOICE_PROCESSED') {
        console.log('Invoice processed')
    } else {
        console.log(`Invoice import failed - Status: ${invoiceTransactionImage.transactionStatus.S}`)

        const putEventPromise = eventBrigdeClient.putEvents({
            Entries: [
                {
                    Source: 'app.invoice',
                    EventBusName: auditBusName,
                    DetailType: 'invoice',
                    Time: new Date(),
                    Detail: JSON.stringify({
                        errorDetail: 'TIMOUT',
                        transactionId: transactionId
                    })
                }
            ]
        }).promise()

        const sendStatusPromise =  invoiceWSService.sendInvoiceStatus(transactionId, connectionId, 'TIMOUT')

        await Promise.all([putEventPromise, sendStatusPromise])
        
        await invoiceWSService.disconnectClient(connectionId)
    }
}

async function createEvent(invoiceImage: {[key: string]: AttributeValue}, eventType: string): Promise<void> {
    const timestamp = Date.now()
    const ttl = ~~(timestamp / 1000 + 60 *60)

    await dynamoDbClient.put({
        TableName: eventsDdb,
        Item: {
            pk: `#invoice_${invoiceImage.sk.S}`,
            sk: `${eventType}#${timestamp}`,
            ttl: ttl,
            email: invoiceImage.pk.S!.split("_")[1],
            createdAt: timestamp,
            eventType: eventType,
            info: {
                transaction: invoiceImage.transactionId.S,
                productId: invoiceImage.productId.S,
                quantity: invoiceImage.quantity.N
            }
        }
    }).promise()

    return
}