import { DocumentClient } from 'aws-sdk/clients/dynamodb'

export enum InvoiceTransactionStatus {
    GENERATED = 'URL_GENERATED',
    RECEIVED = 'INVOICE_RECEIVED',
    PROCESSED = 'INVOICE_PROCESSED',
    TIMEOUT = 'TIMOUT',
    CANCELLED = 'INVOICE_CANCELLED',
    NON_VALID_INVOICE_NUMBER = 'NON_VALID_INVOICE_NUMBER',
    NOT_FOUND ='NOT_FOUND'
}

export interface InvoiceTransaction {
    pk: string;
    sk: string;
    ttl: number;
    requestId: string;
    timestamp: number;
    expiresIn: number;
    connectionId: string;
    endpoint: string;
    transactionStatus: InvoiceTransactionStatus
}

export class InvoiceTransactionRepository {
    private dynamoDbClient: DocumentClient
    private InvoiceTransactionDdb: string

    constructor(dynamoDbClient: DocumentClient, InvoiceTransactionDdb: string) {
        this.dynamoDbClient = dynamoDbClient
        this.InvoiceTransactionDdb = InvoiceTransactionDdb
    }

    async createInvoiceTransaction(invoiceTransaction: InvoiceTransaction): Promise<InvoiceTransaction> {
        await this.dynamoDbClient.put({
            TableName: this.InvoiceTransactionDdb,
            Item: invoiceTransaction
        }).promise()

        return invoiceTransaction
    }

    async getInvoiceTransaction(key: string): Promise<InvoiceTransaction> {
        const data = await this.dynamoDbClient.get({
            TableName: this.InvoiceTransactionDdb,
            Key: {
                pk: '#transaction',
                sk: key
            }
        }).promise()

        if (data.Item) {
            return data.Item as InvoiceTransaction
        } else {
            throw new Error('Invoice transaction not found')
        }
    }

    async updateInvoiceTransaction(key: string, status: InvoiceTransactionStatus): Promise<boolean> {
        try {
            await this.dynamoDbClient.update({
                TableName: this.InvoiceTransactionDdb,
                Key: {
                    pk: '#transaction',
                    sk: key
                },
                ConditionExpression: 'attribute_exists(pk)',
                UpdateExpression: 'set transactionStatus = :s',
                ExpressionAttributeValues: {
                    ':s': status
                }
            }).promise()
            return true
        } catch (ConditionalCheckFailedException) {
            console.error('Invoice transaction not found')
            return false
        }
    }
}