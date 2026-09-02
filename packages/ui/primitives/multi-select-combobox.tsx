import * as React from 'react';

import type { MessageDescriptor } from '@lingui/core';
import { msg, t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans, useLingui as useLinguiMacro } from '@lingui/react/macro';
import { AnimatePresence } from 'framer-motion';
import { Check, ChevronsUpDown, Loader, XIcon } from 'lucide-react';

import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';

import { cn } from '../lib/utils';
import { Button } from './button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

type OptionValue = string | number | boolean | null;

type ComboBoxOption<T = OptionValue> = {
  label: string;
  value: T;
  disabled?: boolean;
  /** Additional text used for search matching. Defaults to the label. */
  keywords?: string;
  /** Optional secondary line shown below the label. */
  description?: string;
};

type MultiSelectComboboxProps<T = OptionValue> = {
  emptySelectionPlaceholder?: React.ReactElement | string;
  enableClearAllButton?: boolean;
  enableSearch?: boolean;
  className?: string;
  contentClassName?: string;
  loading?: boolean;
  inputPlaceholder?: MessageDescriptor;
  onChange: (_values: T[]) => void;
  options: ComboBoxOption<T>[];
  selectedValues: T[];
  testId?: string;
};

/**
 * Multi select combo box component which supports:
 *
 * - Label/value pairs
 * - Loading state
 * - Clear all button
 */
export function MultiSelectCombobox<T = OptionValue>({
  emptySelectionPlaceholder = t`Select values...`,
  enableClearAllButton,
  enableSearch = true,
  className,
  contentClassName,
  inputPlaceholder,
  loading,
  onChange,
  options,
  selectedValues,
  testId,
}: MultiSelectComboboxProps<T>) {
  const { _ } = useLingui();
  const { t: translate } = useLinguiMacro();

  const [open, setOpen] = React.useState(false);

  const handleSelect = (selectedOption: T) => {
    let newSelectedOptions = [...selectedValues, selectedOption];

    if (selectedValues.includes(selectedOption)) {
      newSelectedOptions = selectedValues.filter((v) => v !== selectedOption);
    }

    onChange(newSelectedOptions);
  };

  const selectedOptions = React.useMemo(() => {
    return selectedValues.map((value): ComboBoxOption<T> => {
      const foundOption = options.find((option) => option.value === value);

      if (foundOption) {
        return foundOption;
      }

      let label = '';

      if (typeof value === 'string' || typeof value === 'number') {
        label = value.toString();
      }

      return {
        label,
        value,
      };
    });
  }, [selectedValues, options]);

  const buttonLabel = React.useMemo(() => {
    if (loading) {
      return '';
    }

    if (selectedOptions.length === 0) {
      return emptySelectionPlaceholder;
    }

    if (selectedOptions.length === 1) {
      return selectedOptions[0].label;
    }

    return translate`${selectedOptions.length} selected`;
  }, [selectedOptions, emptySelectionPlaceholder, loading, translate]);

  const showClearButton = enableClearAllButton && selectedValues.length > 0;
  const searchPlaceholder =
    inputPlaceholder !== undefined ? _(inputPlaceholder) : _(msg`Search...`);

  return (
    <Popover modal open={open && !loading} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            disabled={loading}
            aria-expanded={open}
            className={cn('h-auto min-h-10 w-[200px] px-3 py-2', className)}
            data-testid={testId}
          >
            <AnimatePresence>
              {loading ? (
                <div className="flex items-center justify-center">
                  <Loader className="h-5 w-5 animate-spin text-gray-500 dark:text-gray-100" />
                </div>
              ) : (
                <AnimateGenericFadeInOut className="flex w-full justify-between">
                  <span className="truncate text-left font-normal">{buttonLabel}</span>

                  <div
                    className={cn('ml-2 flex flex-row items-center', {
                      'ml-6': showClearButton,
                    })}
                  >
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </div>
                </AnimateGenericFadeInOut>
              )}
            </AnimatePresence>
          </Button>
        </PopoverTrigger>

        {/* This is placed outside the trigger since we can't have nested buttons. */}
        {showClearButton && !loading && (
          <div className="absolute bottom-0 right-8 top-0 flex items-center justify-center">
            <button
              type="button"
              className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-300 dark:bg-neutral-700"
              onClick={() => onChange([])}
            >
              <XIcon className="text-muted-foreground h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <PopoverContent
        align="start"
        className={cn(
          'z-[50000000] w-[var(--radix-popover-trigger-width)] p-0',
          contentClassName,
        )}
        onWheel={(event) => {
          event.stopPropagation();
        }}
        onTouchMove={(event) => {
          event.stopPropagation();
        }}
      >
        <Command>
          {enableSearch && <CommandInput placeholder={searchPlaceholder} />}
          <CommandList className="max-h-[min(300px,50vh)]">
            <CommandEmpty>
              <Trans>No results found.</Trans>
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const searchValue = option.keywords ?? option.label;

                return (
                  <CommandItem
                    key={String(option.value)}
                    disabled={option.disabled}
                    value={`${searchValue} ${String(option.value)}`}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        selectedValues.includes(option.value) ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {option.description ? (
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{option.label}</span>
                        <span className="text-muted-foreground truncate text-xs">
                          {option.description}
                        </span>
                      </div>
                    ) : (
                      <span className="truncate">{option.label}</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
