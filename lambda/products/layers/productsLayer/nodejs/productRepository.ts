import { DocumentClient } from 'aws-sdk/clients/dynamodb'
import { v4 as uuid } from 'uuid'

export interface Product {
    id: string;
    productName: string;
    code: string;
    price: number;
    model: string;
    productUrl: string;
}

export class ProductRepository {
    private dynamoDbClient: DocumentClient
    private productDynamoDb: string
    
    constructor(dynamoDbClient: DocumentClient, productDynamoDb: string) {
        this.dynamoDbClient = dynamoDbClient
        this.productDynamoDb = productDynamoDb
    }

    async getAllProducts(): Promise<Product[]> {
        console.log(`TableName Get: ${this.productDynamoDb}`)
        const data = await this.dynamoDbClient.scan({
            TableName: this.productDynamoDb
        }).promise()

        return data.Items as Product[]
    }

    async getProductById(productId: string): Promise<Product> {
        const data = await this.dynamoDbClient.get({
            TableName: this.productDynamoDb,
            Key: {
                id: productId
            }
        }).promise()

        if (data.Item) {
            return data.Item as Product
        } else {
            throw new Error('Product not found')
        }
    }

    async createProduct(product: Product): Promise<Product> {

        console.log(`Product Detail: ${JSON.stringify(product)}`)

        product.id = uuid()

        console.log(`TableName Post: ${this.productDynamoDb}`)

        await  this.dynamoDbClient.put({
            TableName: this.productDynamoDb,
            Item: product
        }).promise()

        return product
    }

    async deleteProduct(productId: string): Promise<Product> {
        const data = await this.dynamoDbClient.delete({
            TableName: this.productDynamoDb,
            Key: {
                id: productId
            },
            ReturnValues: 'ALL_OLD'
        }).promise()

        if (data.Attributes) {
            return data.Attributes as Product
        } else {
            throw new Error('Product not found')
        }
    }

    async updateProduct(productId: string, product: Product): Promise<Product> {
        const data = await this.dynamoDbClient.update({
            TableName: this.productDynamoDb,
            Key: {
                id: productId
            },
            ConditionExpression: 'attribute_exists(id)',
            ReturnValues: 'UPDATED_NEW',
            UpdateExpression: 'set productName = :n, code = :c, price = :p, model = :m, productUrl = :u',
            ExpressionAttributeValues: {
                ":n": product.productName,
                ":c": product.code,
                ":p": product.price,
                ":m": product.model,
                ":u": product.productUrl
            }
        }).promise()

        data.Attributes!.id = productId

        return data.Attributes as Product
    }

    async getProductsByIds(productIds: string[]): Promise<Product[]> {
        const keys: { id: string; }[] = []
        productIds.forEach((productId) => {
            keys.push({ id: productId })
        })

        const data = await this.dynamoDbClient.batchGet({
            RequestItems: {
                [this.productDynamoDb]: {
                    Keys: keys
                }
            }
        }).promise()
        
        return data.Responses![this.productDynamoDb] as Product[]
    }
}