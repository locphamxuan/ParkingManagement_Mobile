import { apiRequest } from '@/services/api';
import { submitParkingFeedback } from '@/services/feedback';

jest.mock('@/services/api', () => ({
  apiRequest: jest.fn(),
}));

const request = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('feedback API contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps the mobile field name to the backend parkingSession field', async () => {
    request.mockResolvedValueOnce({
      data: { feedback: { _id: 'feedback-1', rating: 5, comment: 'Great' } },
    });

    await submitParkingFeedback('user-token', {
      parkingSessionId: 'session-1',
      rating: 5,
      comment: 'Great',
    });

    expect(request).toHaveBeenCalledWith('/users/feedbacks', {
      method: 'POST',
      token: 'user-token',
      body: {
        parkingSession: 'session-1',
        rating: 5,
        comment: 'Great',
        portraitImageUrl: null,
        plateImageUrl: null,
      },
    });
  });
});
