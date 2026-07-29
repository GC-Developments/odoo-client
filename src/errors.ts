export class OdooError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OdooError";
  }
}

export class OdooAuthError extends OdooError {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "OdooAuthError";
  }
}

export class OdooNetworkError extends OdooError {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "OdooNetworkError";
  }
}
