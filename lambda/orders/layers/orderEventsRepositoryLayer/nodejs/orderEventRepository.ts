import { DocumentClient } from 'aws-sdk/clients/dynamodb'

export interface OrderEventDdb {
    pk: string;
    sk: string;
    ttl: number;
    email: string;
    createdAt: number;
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

    async getOrderEventsByEmail(email: string) {
        const data = await this.dynamoDbClient.query({
            TableName: this.eventDynamoDb,
            IndexName: 'emailIndex',
            KeyConditionExpression: 'email = :email AND begins_with(sk, :prefix)',
            ExpressionAttributeValues: {
                ':email': email,
                ':prefix': 'ORDER_'
            }
        }).promise()
        return data.Items as OrderEventDdb[]
    }

    async getOrderEventsByEmailAndEventType(email: string, eventType: string) {
        const data = await this.dynamoDbClient.query({
            TableName: this.eventDynamoDb,
            IndexName: 'emailIndex',
            KeyConditionExpression: 'email = :email AND begins_with(sk, :prefix)',
            ExpressionAttributeValues: {
                ':email': email,
                ':prefix': eventType
            }
        }).promise()
        return data.Items as OrderEventDdb[]
    }
}