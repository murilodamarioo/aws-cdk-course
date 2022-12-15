import * as AWSXRay from 'aws-xray-sdk'
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

    const method = event.httpMethod

    if (event.resource === '/products') {
        if (method === 'GET') {
            console.log('GET /products')

            const products = await productRepository.getAllProducts()

            return {
                statusCode: 200,
                body: JSON.stringify({products: products})
            }
        }
    } else if (event.resource === '/products/{id}') {
        const productId = event.pathParameters!.id as string

        console.log(`GET /products/${productId}`)


        try {
            const product = await productRepository.getProductbyId(productId)

            return {
                statusCode: 200,
                body: JSON.stringify(product)
            }
        } catch(error) {
            console.error((<Error>error).message)
            return {
                statusCode: 404,
                body: (<Error>error).message
            }
        }
    }

    return {
        statusCode: 400,
        body: JSON.stringify({
            message: 'Bad Request'
        })
    }
}