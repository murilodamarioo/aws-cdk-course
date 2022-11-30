import { APIGatewayProxyEvent, APIGatewayProxyResultV2, Context } from 'aws-lambda'

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResultV2> {

    const lambdaRequestId = context.awsRequestId
    const apiRequestId = event.requestContext.requestId

    console.log(`API Gateway ResquestId: ${apiRequestId} - Lambda RequestId: ${lambdaRequestId}`)

    const method = event.httpMethod

    if (event.resource === '/products') {
        if (method === 'GET') {
            console.log('GET')

            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'GET Products - Ok' 
                })
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