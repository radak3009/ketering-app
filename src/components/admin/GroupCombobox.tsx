import { useState, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface GroupComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  onCreate: (name: string) => Promise<string | null>;
  onDeleteOption?: (name: string) => void;
  placeholder?: string;
  emptyLabel?: string;
}

export function GroupCombobox({
  value,
  onChange,
  options,
  onCreate,
  onDeleteOption,
  placeholder = "Izaberite grupu...",
  emptyLabel = "Bez grupe",
}: GroupComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedSearch = search.trim();
  const filteredOptions = options.filter((o) =>
    o.toLowerCase().includes(normalizedSearch.toLowerCase())
  );
  const exactMatch = options.some(
    (o) => o.toLowerCase() === normalizedSearch.toLowerCase()
  );

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  const handleCreate = async () => {
    if (!normalizedSearch || creating) return;
    setCreating(true);
    try {
      const created = await onCreate(normalizedSearch);
      if (created) {
        onChange(created);
        setOpen(false);
      }
      setSearch("");
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate text-left flex-1">
            {value || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <Command shouldFilter={false}>
          <CommandInput
            ref={inputRef}
            value={search}
            onValueChange={setSearch}
            placeholder="Pretraži grupe..."
          />
          <CommandList>
            <CommandEmpty>
              {normalizedSearch ? (
                <button
                  type="button"
                  className="flex items-center gap-2 px-2 py-1.5 text-sm w-full text-left hover:bg-accent rounded-sm text-primary"
                  onClick={handleCreate}
                  disabled={creating}
                >
                  <Plus className="h-4 w-4" />
                  <span>Dodaj „{normalizedSearch}"</span>
                </button>
              ) : (
                <span className="px-2 py-1.5 text-sm text-muted-foreground">
                  Nema rezultata
                </span>
              )}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                key="__empty__"
                value="__empty__"
                onSelect={() => select("")}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    !value ? "opacity-100" : "opacity-0"
                  )}
                />
                {emptyLabel}
              </CommandItem>
              {filteredOptions.map((o) => {
                const isSelected = value === o;
                return (
                  <CommandItem
                    key={o}
                    value={o}
                    onSelect={() => select(o)}
                    className="group"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1">{o}</span>
                    {onDeleteOption && (
                      <button
                        type="button"
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20 text-destructive transition-opacity"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDeleteOption(o);
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </CommandItem>
                );
              })}
              {normalizedSearch && !exactMatch && (
                <CommandItem
                  key="__create__"
                  value={`__create__${normalizedSearch}`}
                  onSelect={handleCreate}
                  className="text-primary border-t mt-1 pt-1.5"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Dodaj „{normalizedSearch}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
