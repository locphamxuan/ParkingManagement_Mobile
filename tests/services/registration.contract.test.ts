/** The password must not be sent until the OTP-verified request. */
import { apiRequest } from '@/services/api';
import { requestRegistration, verifyRegistration } from '@/services/auth';

jest.mock('@/services/api', () => ({
  apiRequest: jest.fn(),
}));

const request = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('OTP registration contract', () => {
  beforeEach(() => jest.clearAllMocks());

  it('omits the password from register-request', async () => {
    await requestRegistration({
      fullName: 'New User',
      email: 'new@test.com',
      password: 'correct-horse-battery',
      phone: '0900000001',
    });

    const [path, options] = request.mock.calls[0];
    expect(path).toBe('/users/auth/register-request');
    expect(options?.body).toEqual({
      fullName: 'New User',
      email: 'new@test.com',
      phone: '0900000001',
    });
    expect(options?.body).not.toHaveProperty('password');
  });

  it('sends the password with the verified OTP', async () => {
    request.mockResolvedValueOnce({
      data: { token: 't', user: { _id: 'u1', email: 'new@test.com', fullName: 'New', role: 'user' } },
    });

    await verifyRegistration('new@test.com', '123456', 'correct-horse-battery');

    const [path, options] = request.mock.calls[0];
    expect(path).toBe('/users/auth/register-verify');
    expect(options?.body).toEqual({
      email: 'new@test.com',
      otp: '123456',
      password: 'correct-horse-battery',
    });
  });
});
