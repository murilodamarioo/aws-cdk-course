import { ApiGatewayManagementApi } from 'aws-sdk'

export class InvoiceWSService {
    private apigwManagementAPI: ApiGatewayManagementApi

    constructor(apigwManagementAPI: ApiGatewayManagementApi) {
        this.apigwManagementAPI = apigwManagementAPI
    }

    async sendData(connectionId: string, data: string): Promise<boolean> {

        try {
            await this.apigwManagementAPI.getConnection({
                ConnectionId: connectionId
            }).promise()

            await this.apigwManagementAPI.postToConnection({
                ConnectionId: connectionId,
                Data: data
            }).promise()

            return true
        } catch (error) {
            console.error(error)
            return false
        }
    }
}