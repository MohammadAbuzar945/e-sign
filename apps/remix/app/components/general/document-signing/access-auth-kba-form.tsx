import { useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { TRecipientAccessAuth } from '@documenso/lib/types/document-auth';
import { trpc } from '@documenso/trpc/react';
import { Alert } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { RadioGroup, RadioGroupItem } from '@documenso/ui/primitives/radio-group';

const ZAccessAuthKBAFormSchema = z.object({
  answer: z.string().optional(),
});

type TAccessAuthKBAFormSchema = z.infer<typeof ZAccessAuthKBAFormSchema>;

export type AccessAuthKBAFormProps = {
  token: string;
  onSubmit: (accessAuthOptions: TRecipientAccessAuth) => void;
  error?: string | null;
  descriptionText?: string;
  submitButtonText?: string;
};

export const AccessAuthKBAForm = ({
  token,
  onSubmit,
  error,
  descriptionText,
  submitButtonText,
}: AccessAuthKBAFormProps) => {
  const { _ } = useLingui();
  const [selectedMcqOptionKey, setSelectedMcqOptionKey] = useState('');
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const form = useForm<TAccessAuthKBAFormSchema>({
    resolver: zodResolver(ZAccessAuthKBAFormSchema),
    defaultValues: {
      answer: '',
    },
  });

  const { data, isLoading } = trpc.document.accessAuth.getKbaChallenge.useQuery({
    token,
  });
  const { mutateAsync: verifyKba, isPending: isVerifyingKba } =
    trpc.document.accessAuth.verifyKba.useMutation();

  const isMcq = data?.answerType === 'MCQ';
  const isNumeric = data?.answerType === 'NUMERIC';
  const typedAnswer = form.watch('answer');

  const canSubmit = useMemo(() => {
    if (!data) {
      return false;
    }

    if (isMcq) {
      return selectedMcqOptionKey.length > 0;
    }

    if (!typedAnswer?.trim()) {
      return false;
    }

    if (isNumeric && !/^\d+$/.test(typedAnswer.trim())) {
      return false;
    }

    return true;
  }, [data, isMcq, isNumeric, selectedMcqOptionKey.length, typedAnswer]);

  const onFormSubmit = async (values: TAccessAuthKBAFormSchema) => {
    const answer = isMcq ? selectedMcqOptionKey : values.answer;

    if (!answer) {
      return;
    }

    if (!isMcq && isNumeric && !/^\d+$/.test(answer.trim())) {
      form.setError('answer', {
        message: _(msg`Only numbers are allowed. Remove any letters or symbols.`),
      });

      return;
    }

    setSubmissionError(null);

    const verificationResult = await verifyKba({
      token,
      answer,
    }).catch(() => null);

    if (!verificationResult || !verificationResult.success) {
      const errorMessage = verificationResult?.isLocked
        ? _(msg`Too many failed attempts. Please try again later.`)
        : _(msg`Invalid answer. ${verificationResult?.attemptsRemaining ?? 0} attempts remaining.`);

      if (isMcq) {
        setSubmissionError(errorMessage);
      } else {
        form.setError('answer', {
          message: errorMessage,
        });
      }

      return;
    }

    onSubmit({
      type: 'KBA',
      answer,
    });
  };

  if (isLoading) {
    return (
      <div className="py-4 text-sm text-muted-foreground">
        <Trans>Loading security challenge...</Trans>
      </div>
    );
  }

  if (!data) {
    return (
      <Alert variant="destructive" padding="tight" className="text-sm">
        <Trans>Unable to load KBA challenge for this document.</Trans>
      </Alert>
    );
  }

  return (
    <Form {...form}>
      <form className="space-y-4 py-2" onSubmit={form.handleSubmit(onFormSubmit)}>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">
            <Trans>Security challenge</Trans>
          </h3>

          <p className="text-sm text-muted-foreground">
            {descriptionText ? (
              descriptionText
            ) : (
              <Trans>Please answer the question below to complete this document.</Trans>
            )}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm font-medium">
          {data.question}
        </div>

        {error && (
          <Alert variant="destructive" padding="tight" className="text-sm">
            {error}
          </Alert>
        )}

        {submissionError && (
          <Alert variant="destructive" padding="tight" className="text-sm">
            {submissionError}
          </Alert>
        )}

        {isMcq ? (
          <FormItem>
            <FormLabel>
              <Trans>Select one option</Trans>
            </FormLabel>

            <RadioGroup value={selectedMcqOptionKey} onValueChange={setSelectedMcqOptionKey}>
              {data.mcqOptions.map((option) => (
                <label
                  key={option.key}
                  className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm"
                >
                  <RadioGroupItem value={option.key} />
                  <span>{option.label}</span>
                </label>
              ))}
            </RadioGroup>
          </FormItem>
        ) : (
          <FormField
            control={form.control}
            name="answer"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Answer</Trans>
                </FormLabel>
                <FormControl>
                  <Input
                    name={field.name}
                    ref={field.ref}
                    value={field.value ?? ''}
                    onBlur={field.onBlur}
                    inputMode={isNumeric ? 'numeric' : 'text'}
                    placeholder={
                      isNumeric ? _(msg`Digits only (e.g. 1234)`) : _(msg`Enter your answer`)
                    }
                    onChange={
                      isNumeric
                        ? (e) => field.onChange(e.target.value.replace(/\D/g, ''))
                        : field.onChange
                    }
                  />
                </FormControl>
                {isNumeric ? (
                  <FormDescription>
                    <Trans>Only numbers are allowed—letters and symbols are not accepted.</Trans>
                  </FormDescription>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button type="submit" className="w-full" disabled={!canSubmit} loading={isVerifyingKba}>
          {submitButtonText ?? <Trans>Verify & Complete</Trans>}
        </Button>
      </form>
    </Form>
  );
};

