// Injection tokens — shared symbols so services and the app module can both
// reference them without circular imports.

export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');
export const ID_GENERATOR = Symbol('ID_GENERATOR');
export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
