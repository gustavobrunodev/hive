import "./base.css";

export { BrandMark } from "./components/BrandMark/BrandMark";
export { Logo } from "./components/Logo/Logo";
export { Button } from "./components/Button/Button";
export { Badge } from "./components/Badge/Badge";
export { Chip } from "./components/Chip/Chip";
export { PinChip } from "./components/PinChip/PinChip";
export { Panel } from "./components/Panel/Panel";
export { Callout } from "./components/Callout/Callout";
export { SectionHeading } from "./components/SectionHeading/SectionHeading";

export { ValueGrid, ValueCard } from "./components/ValueCard/ValueCard";
export { SkillGrid, SkillCard, SkillSpinePin } from "./components/SkillCard/SkillCard";
export { CaseGrid, CaseCard } from "./components/CaseCard/CaseCard";
export { ModeSplit, ModeBlock } from "./components/ModeBlock/ModeBlock";

export { Terminal } from "./components/Terminal/Terminal";
export { Table, Pkg, Stack, Cond } from "./components/Table/Table";
export { SteppedList, SteppedListItem } from "./components/SteppedList/SteppedList";
export { CodeBlock, Cor, Cmt } from "./components/CodeBlock/CodeBlock";

export { Flow, SpineLabel, Steps, Step, Substeps, Sub } from "./components/Timeline/Timeline";
export { DotsBackground } from "./components/DotsBackground/DotsBackground";
export { Reveal, Stagger } from "./components/Reveal/Reveal";

export { Nav } from "./components/Nav/Nav";
export { Footer } from "./components/Footer/Footer";

export { HarnessMark } from "./components/HarnessMark/HarnessMark";

export { VisuallyHidden } from "./components/VisuallyHidden/VisuallyHidden";

// Phase 1 — forms
export { Input } from "./components/Input/Input";
export { Textarea } from "./components/Textarea/Textarea";
export { Label } from "./components/Label/Label";
export { Field } from "./components/Field/Field";
export { Checkbox } from "./components/Checkbox/Checkbox";
export { RadioGroup, RadioGroupItem } from "./components/RadioGroup/RadioGroup";
export { Switch } from "./components/Switch/Switch";
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
} from "./components/Select/Select";
export { Slider } from "./components/Slider/Slider";

// Phase 1 — overlays
export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogTitle, DialogDescription } from "./components/Dialog/Dialog";
export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "./components/AlertDialog/AlertDialog";
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor, PopoverClose } from "./components/Popover/Popover";
export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "./components/Tooltip/Tooltip";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "./components/DropdownMenu/DropdownMenu";
export {
  Toast,
  ToastProvider,
  ToastViewport,
  ToastTitle,
  ToastDescription,
  ToastAction,
  ToastClose,
  useToast,
} from "./components/Toast/Toast";

// Phase 1 — feedback
export { Spinner } from "./components/Spinner/Spinner";
export { Skeleton } from "./components/Skeleton/Skeleton";

// Phase 2 — structure
export { Separator } from "./components/Separator/Separator";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/Tabs/Tabs";
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./components/Accordion/Accordion";
export { ScrollArea } from "./components/ScrollArea/ScrollArea";
export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription } from "./components/Sheet/Sheet";

// Phase 2 — navigation/data
export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuLabel,
} from "./components/ContextMenu/ContextMenu";
export { Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator } from "./components/Command/Command";
export { Breadcrumb, BreadcrumbItem } from "./components/Breadcrumb/Breadcrumb";
export { Tree } from "./components/Tree/Tree";
export { Avatar } from "./components/Avatar/Avatar";
export { Progress } from "./components/Progress/Progress";
export { LevelMeter } from "./components/LevelMeter/LevelMeter";
export type { LevelMeterProps } from "./components/LevelMeter/LevelMeter";
export { Alert } from "./components/Alert/Alert";
export { Empty } from "./components/Empty/Empty";
export { Kbd } from "./components/Kbd/Kbd";
export { Resizable, ResizablePanel, ResizableHandle } from "./components/Resizable/Resizable";
export { SegmentedControl } from "./components/SegmentedControl/SegmentedControl";
export type {
  SegmentedControlProps,
  SegmentedOption,
  SegmentedTone,
} from "./components/SegmentedControl/SegmentedControl";

// Phase 3 — generic AI-chat primitives
export { ChatMessage } from "./components/ChatMessage/ChatMessage";
export { TypingIndicator } from "./components/TypingIndicator/TypingIndicator";
export { MessageList } from "./components/MessageList/MessageList";
export { Attachment } from "./components/Attachment/Attachment";
export { PromptInput } from "./components/PromptInput/PromptInput";
