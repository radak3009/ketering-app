import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { sr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EnhancedDatePickerProps {
  date?: Date;
  onDateChange: (date: Date | undefined) => void;
  disabled?: (date: Date) => boolean;
  placeholder?: string;
  className?: string;
}

const months = [
  "Januar",
  "Februar",
  "Mart",
  "April",
  "Maj",
  "Jun",
  "Jul",
  "Avgust",
  "Septembar",
  "Oktobar",
  "Novembar",
  "Decembar",
];

export function EnhancedDatePicker({
  date,
  onDateChange,
  disabled,
  placeholder = "Izaberite datum",
  className,
}: EnhancedDatePickerProps) {
  const [inputValue, setInputValue] = React.useState("");
  const [month, setMonth] = React.useState<Date>(date || new Date());
  const [open, setOpen] = React.useState(false);

  // Update input value when date changes from calendar
  React.useEffect(() => {
    if (date) {
      setInputValue(format(date, "dd.MM.yyyy"));
      setMonth(date);
    } else {
      setInputValue("");
    }
  }, [date]);

  // Handle manual input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Try to parse the date if format matches dd.MM.yyyy
    if (value.length === 10) {
      const parsedDate = parse(value, "dd.MM.yyyy", new Date());
      if (isValid(parsedDate)) {
        // Check if date passes disabled validation
        if (!disabled || !disabled(parsedDate)) {
          onDateChange(parsedDate);
          setMonth(parsedDate);
        }
      }
    }
  };

  // Handle input blur - validate and format
  const handleInputBlur = () => {
    if (inputValue.length === 10) {
      const parsedDate = parse(inputValue, "dd.MM.yyyy", new Date());
      if (isValid(parsedDate)) {
        if (!disabled || !disabled(parsedDate)) {
          onDateChange(parsedDate);
          setInputValue(format(parsedDate, "dd.MM.yyyy"));
        } else {
          // Reset to previous valid date or empty
          setInputValue(date ? format(date, "dd.MM.yyyy") : "");
        }
      } else {
        // Invalid date, reset
        setInputValue(date ? format(date, "dd.MM.yyyy") : "");
      }
    } else if (inputValue === "") {
      onDateChange(undefined);
    }
  };

  // Handle month change from dropdown
  const handleMonthChange = (value: string) => {
    const newMonth = parseInt(value);
    const newDate = new Date(month.getFullYear(), newMonth, 1);
    setMonth(newDate);
  };

  // Handle year change from dropdown
  const handleYearChange = (value: string) => {
    const newYear = parseInt(value);
    const newDate = new Date(newYear, month.getMonth(), 1);
    setMonth(newDate);
  };

  // Generate year options (1900 to current year)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1900 + 1 }, (_, i) => 1900 + i).reverse();

  return (
    <div className={cn("flex gap-2", className)}>
      <Input
        type="text"
        placeholder="dd.MM.yyyy"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        className="flex-1"
        maxLength={10}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-10 p-0",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="flex gap-2 p-3 border-b">
            <Select
              value={month.getMonth().toString()}
              onValueChange={handleMonthChange}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((monthName, index) => (
                  <SelectItem key={index} value={index.toString()}>
                    {monthName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={month.getFullYear().toString()}
              onValueChange={handleYearChange}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Calendar
            mode="single"
            selected={date}
            onSelect={(newDate) => {
              onDateChange(newDate);
              setOpen(false);
            }}
            month={month}
            onMonthChange={setMonth}
            disabled={disabled}
            initialFocus
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
