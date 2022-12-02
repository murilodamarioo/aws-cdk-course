import { StringFilter } from "aws-sdk/clients/securityhub";

export enum ProductEventType {
    CREATED = 'PRODUCT_CREATED',
    UPDATED = 'PRODUCT_UPDATED',
    DELETE = 'PRODUCT_DELETED'
}

export interface ProductEvent {
    requestId: string;
    eventType: ProductEventType;
    productId: string;
    productCode: String;
    productPrice: number;
    email: string;
}