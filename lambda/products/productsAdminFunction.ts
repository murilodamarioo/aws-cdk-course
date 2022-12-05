import * as AWSXRay from 'aws-xray-sdk'

import { Product } from '/opt/nodejs/productsLayer'

import { APIGatewayProxyEvent, APIGatewayProxyResultV2, Context } from 'aws-lambda'

import { ProductRepository } from '/opt/nodejs/productsLayer'

import { DynamoDB, Lambda } from 'aws-sdk'

import { ProductEvent, ProductEventType } from '/opt/nodejs/productEventsLayer'

AWSXRay.captureAWS(require('aws-sdk'))

const productsDynamoDb = process.env.PRODUCTS_DDB!
const productEventsFunctionName = process.env.PRODUCT_EVENTS_FUNCTION_NAME
const dynamoDbClient = new DynamoDB.DocumentClient()

const lambdaClient = new Lambda()

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

        const response = await sendProductEvent(productCreated, ProductEventType.CREATED, 'john@gmail.com', lambdaRequestId)
        console.log(response)

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

                const response = await sendProductEvent(productUpdated, ProductEventType.UPDATED, 'john@gmail.com', lambdaRequestId)
                console.log(response)

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

                const response = await sendProductEvent(product, ProductEventType.DELETE, 'john@gmail.com', lambdaRequestId)
                console.log(response)

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

function sendProductEvent(product: Product, eventType: ProductEventType, email: string, lambdaRequestId: string) {
    const event: ProductEvent = {
        email: email,
        eventType:  eventType,
        productCode: product.code,
        productId: product.id,
        productPrice: product.price,
        requestId: lambdaRequestId
    }

    return lambdaClient.invoke({
        FunctionName: productEventsFunctionName,
        Payload: JSON.stringify(event),
        InvocationType: 'Event',
    }).promise()
}