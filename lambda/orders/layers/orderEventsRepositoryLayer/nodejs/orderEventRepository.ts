import { DocumentClient } from 'aws-sdk/clients/dynamodb'

export interface OrderEventDdb {
    pk: string;
    sk: string;
    ttl: number;
    email: string;
    createdAt: string;
    requestId: string;
    eventType: string;
    info: {
        orderId: string;
        productCodes: string[];
        messageId: string;
    }
}

export class OrderEventRepository {
    private dynamoDbClient: DocumentClient
    private eventDynamoDb: string

    constructor(dynamoDbClient: DocumentClient, eventDynamoDb: string) {
        this.dynamoDbClient = dynamoDbClient
        this.eventDynamoDb = eventDynamoDb
    }

    createOrderEvent(orderEvent: OrderEventDdb) {
        return this.dynamoDbClient.put({
            TableName: this.eventDynamoDb,
            Item: orderEvent
        }).promise()
    }
}