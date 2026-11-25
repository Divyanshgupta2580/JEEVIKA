import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>>(({ className, children, ...props }, ref) => (
    <SelectPrimitive.Trigger
        ref={ref}
        className={cn(
            "group flex min-h-10 w-full items-center justify-between gap-2.5 rounded-xl border border-[#CEDAD3] bg-white px-3.5 py-2 text-left text-sm font-medium text-[#0E2420] ring-offset-background transition-colors placeholder:text-[#5D726B] hover:border-[#9FBCAE] focus:outline-none focus:ring-2 focus:ring-[#047C61]/20 focus:border-[#047C61] data-[state=open]:border-[#047C61] data-[state=open]:ring-2 data-[state=open]:ring-[#047C61]/15 disabled:cursor-not-allowed disabled:opacity-50",
            className,
        )}
        {...props}
    >
        {children}
        <SelectPrimitive.Icon asChild>
            <ChevronDown className="ml-2 mr-0.5 h-4 w-4 shrink-0 text-[#047C61] transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectContent = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Content>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>>(({ className, children, position = "popper", side = "bottom", sideOffset = 6, collisionPadding = 16, ...props }, ref) => (
    <SelectPrimitive.Portal>
        <SelectPrimitive.Content
            ref={ref}
            side={side}
            sideOffset={sideOffset}
            collisionPadding={collisionPadding}
            className={cn("relative z-50 min-w-[10rem] overflow-hidden rounded-[14px] border border-[#D5E2DA] bg-white p-1.5 text-[#0E2420] shadow-[0_18px_40px_-10px_rgba(14,36,32,0.16),0_4px_12px_-2px_rgba(14,36,32,0.06)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2", position === "popper" && "data-[side=bottom]:translate-y-0.5 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-0.5", className)}
            position={position}
            {...props}
        >
            <SelectPrimitive.Viewport className={cn("p-0.5", position === "popper" && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]")}>
                {children}
            </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectItem = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Item>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>>(({ className, children, ...props }, ref) => (
    <SelectPrimitive.Item
        ref={ref}
        className={cn("relative flex w-full cursor-pointer select-none items-center rounded-[10px] py-2 pl-3.5 pr-9 text-[14.5px] font-medium text-[#162E29] outline-none transition-colors focus:bg-[#EFF7F2] focus:text-[#047C61] data-[state=checked]:bg-[#E6F4EC] data-[state=checked]:font-semibold data-[state=checked]:text-[#035E4A] data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className)}
        {...props}
    >
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        <span className="absolute right-3 flex h-4 w-4 items-center justify-center text-[#047C61]">
            <SelectPrimitive.ItemIndicator>
                <Check className="h-4 w-4" />
            </SelectPrimitive.ItemIndicator>
        </span>
    </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem }
