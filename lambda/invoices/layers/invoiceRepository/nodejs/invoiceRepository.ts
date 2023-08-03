import { DocumentClient } from "aws-sdk/clients/dynamodb";

export interface InvoiceFile {
    customerName: string;
    invoiceNumber: string;
    totalValue: number;
    productId: string;
    quantity: number;
}

export interface Invoice {
    pk: string;
    sk: string;
    totalValue: number;
    productId: string;
    quantity: number;
    transactionId: string;
    ttl: number;
    createdAt: number;
}

export class InvoiceRepository {
    private dynamoDbClient: DocumentClient
    private invoicesDdb: string

    constructor(dynamoDbClient: DocumentClient, invoicesDdb: string) {
        this.dynamoDbClient = dynamoDbClient
        this.invoicesDdb = invoicesDdb
    }

    async create(invoice: Invoice): Promise<Invoice> {
        await this.dynamoDbClient.put({
            TableName: this.invoicesDdb,
            Item: invoice
        }).promise()

        return invoice
    }
}