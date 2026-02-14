import { createUniversalMock } from './black-hole';

export const provideMock = (token: any, mockName: string) => ({
  provide: token,
  useFactory: () => createUniversalMock(mockName),
});
