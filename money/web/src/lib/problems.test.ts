import { AppError, clearProblems, describeError, logProblem, problemReport, problems } from './problems';

describe('problem log', () => {
  beforeEach(() => clearProblems());

  it('keeps the plain message and the exact detail', () => {
    logProblem('Create account', new AppError('Money Hub has the wrong cloud address.', 'AuthApiError 404: Invalid path specified in request URL'));
    expect(problems()[0]).toMatchObject({
      where: 'Create account', message: 'Money Hub has the wrong cloud address.', detail: 'AuthApiError 404: Invalid path specified in request URL', count: 1,
    });
  });

  it('counts the same problem again instead of listing it twice', () => {
    logProblem('Sync', new AppError('Could not reach your cloud.', 'x'));
    logProblem('Sync', new AppError('Could not reach your cloud.', 'x'));
    logProblem('Unlocking', new Error('That password is not right.'));
    expect(problems().map((p) => [p.where, p.count])).toEqual([['Unlocking', 1], ['Sync', 2]]);
  });

  it('keeps only the latest 30', () => {
    for (let i = 0; i < 40; i++) logProblem(`Step ${i}`, new Error('x'));
    expect(problems()).toHaveLength(30);
    expect(problems()[0]!.where).toBe('Step 39');
  });

  it('keeps where an unexpected error broke, but not for messages written for people', () => {
    expect(describeError(new Error('That password is not right.'))).toEqual({ message: 'That password is not right.' });
    const t = describeError(new TypeError("Cannot read properties of undefined (reading 'id')"));
    expect(t.message).toMatch(/Cannot read properties/);
    expect(t.detail).toMatch(/^TypeError at /);
    expect(describeError({ code: 7 })).toEqual({ message: 'Something went wrong.', detail: '{"code":7}' });
  });

  it('writes a report with the app version, device and cloud address', () => {
    logProblem('Create account', new AppError('Wrong cloud address.', 'AuthApiError 404: Invalid path specified in request URL'));
    const r = problemReport(problems(), 'https://abcdefghijklmnop.supabase.co');
    expect(r).toMatch(/^Money Hub problem report\nMoney Hub \S+ web, copied /);
    expect(r).toContain('Cloud: https://abcdefghijklmnop.supabase.co');
    expect(r).toContain('Create account');
    expect(r).toContain('\n  AuthApiError 404: Invalid path specified in request URL');
  });
});
