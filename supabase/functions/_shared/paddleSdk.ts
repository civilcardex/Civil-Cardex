import { Environment, Paddle } from 'npm:@paddle/paddle-node-sdk@3.12.0';
import { paddleConfigurado, PADDLE_API_BASE, PADDLE_API_KEY } from './payment_utils.ts';

export { ApiError, EventName, type EventEntity } from 'npm:@paddle/paddle-node-sdk@3.12.0';

export const entornoPaddle =
  PADDLE_API_BASE === 'https://sandbox-api.paddle.com'
    ? Environment.sandbox
    : Environment.production;

export const paddle = paddleConfigurado()
  ? new Paddle(PADDLE_API_KEY, { environment: entornoPaddle })
  : null;
