import { validateAnswers as validate,readAnswers as read } from '../base-onboarding/prefill.mjs';
import { fields,safeKeys } from './ui/seed.mjs';
export { readSecrets } from '../base-onboarding/prefill.mjs';
export const validateAnswers=input=>validate(input,{fields,safeKeys});
export const readAnswers=path=>read(path,{fields,safeKeys});
