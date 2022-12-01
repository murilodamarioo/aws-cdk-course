import * as AWSXRay from 'aws-xray-sdk'

import { Product } from './layers/productsLayer/nodejs/productRepository'

import { APIGatewayProxyEvent, APIGatewayProxyResultV2, Context } from 'aws-lambda'

import { ProductRepository } from '/opt/nodejs/productsLayer'

import { DynamoDB } from 'aws-sdk'

AWSXRay.captureAWS(require('aws-sdk'))

const productsDynamoDb = process.env.PRODUCTS_DDB!
const dynamoDbClient = new DynamoDB.DocumentClient()

const productRepository = new ProductRepository(dynamoDbClient, productsDynamoDb)


export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResultV2> {
    console.log(event)

    const lambdaRequestId = context.awsRequestId
    const apiRequestId = event.requestContext.requestId

    console.log(`API Gateway ResquestId: ${apiRequestId} - Lambda RequestId: ${lambdaRequestId}`)

    if(event.resource === '/products') {
        console.log('POST /products')

        const product = JSON.parse(event.body!) as Product

        const productCreated = await productRepository.createProduct(product)
        return {
            statusCode: 201,
            body: JSON.stringify({product: productCreated})
        }
    } else if (event.resource === '/products/{id}') {
        const productId = event.pathParameters!.id as string

        if (event.httpMethod === 'PUT') {
            console.log(`PUT /products/${productId}`)

            const product = JSON.parse(event.body!) as Product

            try {
                const productUpdated = await productRepository.updateProduct(productId, product)
                return {
                    statusCode: 200,
                    body: `Product updated ${JSON.stringify(productUpdated)}`
                }
            } catch (ConditionalCheckFailedException) {
                return {
                    statusCode: 404,
                    body: `The product with id ${productId} was not found`
                }
            }

            
        } else if (event.httpMethod === 'DELETE') {
            console.log(`DELETE /products/${productId}`)

            try {
                const product = await productRepository.deleteProduct(productId)
                return {
                    statusCode: 200,
                    body: `Product delete ${JSON.stringify(product)}`
                }
            } catch(error) {
                console.error((<Error>error).message)
                return {
                    statusCode: 404,
                    body: (<Error>error).message
                }
            }
        }
    }
    return {
        statusCode: 400,
        body: 'Bad Request'
    }
}