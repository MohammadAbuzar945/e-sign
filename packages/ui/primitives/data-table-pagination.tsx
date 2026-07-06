import { Plural, Trans } from '@lingui/react/macro';
import type { Table } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { match } from 'ts-pattern';

import { useHydrated } from '../lib/use-hydrated';
import { Button } from './button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

interface DataTablePaginationProps<TData> {
  table: Table<TData>;

  /**
   * The type of information to show on the left hand side of the pagination.
   *
   * Defaults to 'VisibleCount'.
   */
  additionalInformation?: 'SelectedCount' | 'VisibleCount' | 'None';
}

export function DataTablePagination<TData>({
  table,
  additionalInformation = 'VisibleCount',
}: DataTablePaginationProps<TData>) {
  const isHydrated = useHydrated();
  const pageSize = table.getState().pagination.pageSize;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-4 px-2">
      <div className="flex-1 text-sm text-muted-foreground">
        {match(additionalInformation)
          .with('SelectedCount', () => (
            <span>
              <Plural
                value={table.getFilteredRowModel().rows.length}
                one={
                  <Trans>
                    {table.getFilteredSelectedRowModel().rows.length} of # row selected.
                  </Trans>
                }
                other={
                  <Trans>
                    {table.getFilteredSelectedRowModel().rows.length} of # rows selected.
                  </Trans>
                }
              />
            </span>
          ))
          .with('VisibleCount', () => {
            const visibleRows = table.getFilteredRowModel().rows.length;

            return (
              <span data-testid="data-table-count">
                <Plural
                  value={visibleRows}
                  one={`Showing # result.`}
                  other={`Showing # results.`}
                />
              </span>
            );
          })
          .with('None', () => null)
          .exhaustive()}
      </div>

      <div className="flex items-center gap-x-2">
        <p className="whitespace-nowrap text-sm font-medium">
          <Trans>Rows per page</Trans>
        </p>
        {isHydrated ? (
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 40, 50].map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="border-input flex h-8 w-[70px] items-center justify-between rounded-md border bg-transparent px-3 py-2 text-sm">
            {pageSize}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 lg:gap-x-8">
        <div className="flex items-center text-sm font-medium md:justify-center">
          <Trans>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
          </Trans>
        </div>

        <div className="flex items-center gap-x-2">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">
              <Trans>Go to first page</Trans>
            </span>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">
              <Trans>Go to previous page</Trans>
            </span>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">
              <Trans>Go to next page</Trans>
            </span>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">
              <Trans>Go to last page</Trans>
            </span>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
