import { useState, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface AllergensComboboxProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: string[];
  onCreate: (name: string) => Promise<string | null>;
  placeholder?: string;
}

export function AllergensCombobox({
  value,
  onChange,
  options,
  onCreate,
  placeholder = "Izaberite alergene...",
}: AllergensComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = value || [];
  const normalizedSearch = search.trim();

  const filteredOptions = options.filter((o) =>
    o.toLowerCase().includes(normalizedSearch.toLowerCase())
  );

  const exactMatch = options.some(
    (o) => o.toLowerCase() === normalizedSearch.toLowerCase()
  );

  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onChange(selected.filter((v) => v !== name));
    } else {
      onChange([...selected, name]);
    }
  };

  const handleCreate = async () => {
    if (!normalizedSearch || creating) return;
    setCreating(true);
    try {
      const created = await onCreate(normalizedSearch);
      if (created && !selected.includes(created)) {
        onChange([...selected, created]);
      }
      setSearch("");
    } finally {
      setCreating(false);
    }
  };

  // Reset search when popover closes
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal min-h-10 h-auto",
              selected.length === 0 && "text-muted-foreground"
            )}
          >
            <span className="flex flex-wrap gap-1 items-center flex-1 text-left">
              {selected.length === 0 ? (
                <span>{placeholder}</span>
              ) : (
                selected.map((a) => (
                  <Badge
                    key={a}
                    variant="secondary"
                    className="gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {a}
                    <span
                      role="button"
                      tabIndex={0}
                      className="ml-0.5 cursor-pointer hover:text-destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggle(a);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </Badge>
                ))
              )}
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
              placeholder="Pretraži alergene..."
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
              {filteredOptions.length > 0 && (
                <CommandGroup>
                  {filteredOptions.map((o) => {
                    const isSelected = selected.includes(o);
                    return (
                      <CommandItem
                        key={o}
                        value={o}
                        onSelect={() => toggle(o)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {o}
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
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
