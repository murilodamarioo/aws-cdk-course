import { DocumentClient } from 'aws-sdk/clients/dynamodb'

export enum InvoiceTransactionStatus {
    GENERATED = 'URL_GENERATED',
    RECEIVED = 'INVOICE_RECEIVED',
    PROCESSED = 'INVOICE_PROCESSED',
    TIMEOUT = 'TIMOUT',
    CANCEL = 'INVOICE_CANCELLED',
    NON_VALID_INVOICE_NUMBER = 'NON_VALID_INVOICE_NUMBER'
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
    transactionsStatus: InvoiceTransactionStatus
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
}