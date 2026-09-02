import * as React from 'react';

import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { AnimatePresence } from 'framer-motion';
import { Check, ChevronsUpDown, Loader } from 'lucide-react';

import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';

import { cn } from '../lib/utils';
import { Button } from './button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

type SearchableSelectOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

type SearchableSelectProps = {
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
  emptyMessage?: string;
  loading?: boolean;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: MessageDescriptor;
  testId?: string;
  value: string;
};

export const SearchableSelect = ({
  className,
  contentClassName,
  disabled = false,
  emptyMessage,
  loading = false,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  testId,
  value,
}: SearchableSelectProps) => {
  const { _ } = useLingui();
  const [open, setOpen] = React.useState(false);

  const selectedOption = options.find((option) => option.value === value);
  const placeholderText = placeholder ?? _(msg`Select an option`);
  const searchPlaceholderText = searchPlaceholder ? _(searchPlaceholder) : placeholderText;

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setOpen(false);
  };

  return (
    <Popover modal open={open && !loading && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          className={cn(
            'border-input ring-offset-background focus:ring-ring h-10 w-full justify-between bg-transparent px-3 py-2 text-sm font-normal focus:ring-2 focus:ring-offset-2',
            className,
          )}
          data-testid={testId}
        >
          <AnimatePresence>
            {loading ? (
              <div className="flex w-full items-center justify-center">
                <Loader className="h-5 w-5 animate-spin text-gray-500 dark:text-gray-100" />
              </div>
            ) : (
              <AnimateGenericFadeInOut className="flex w-full items-center justify-between gap-2">
                <span className={cn('truncate', !selectedOption && 'text-muted-foreground')}>
                  {selectedOption?.label ?? placeholderText}
                </span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
              </AnimateGenericFadeInOut>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className={cn('z-[1001] w-[var(--radix-popover-trigger-width)] p-0', contentClassName)}
        align="start"
        onWheel={(event) => {
          event.stopPropagation();
        }}
        onTouchMove={(event) => {
          event.stopPropagation();
        }}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholderText} />
          <CommandEmpty>{emptyMessage ?? <Trans>No results found.</Trans>}</CommandEmpty>
          <CommandGroup className="max-h-[250px] overflow-y-auto">
            {options.map((option) => (
              <CommandItem
                key={option.value}
                disabled={option.disabled}
                value={`${option.label} ${option.value}`}
                onSelect={() => handleSelect(option.value)}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    option.value === value ? 'opacity-100' : 'opacity-0',
                  )}
                />
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
