import { ApiGatewayManagementApi } from 'aws-sdk'

export class InvoiceWSService {
    private apigwManagementAPI: ApiGatewayManagementApi

    constructor(apigwManagementAPI: ApiGatewayManagementApi) {
        this.apigwManagementAPI = apigwManagementAPI
    }

    sendInvoiceStatus(transactionId: string, connectionId: string, status: string) {
        const postData = JSON.stringify({
            transactionId: transactionId,
            status: status
        })

        return this.sendData(connectionId, postData)
    }

    async disconnectClient(connectionId: string): Promise<boolean> {
        try {
            await this.apigwManagementAPI.getConnection({
                ConnectionId: connectionId
            }).promise()

            await this.apigwManagementAPI.deleteConnection({
                ConnectionId: connectionId
            }).promise()

            return true
        } catch (error) {
            console.error(error)
            return false
        }
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