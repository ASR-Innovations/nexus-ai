# UI Component Library

Apple-inspired UI component library for NexusAI Protocol frontend. Built with React, TypeScript, Tailwind CSS, Framer Motion, and Radix UI primitives.

## Components

### Button
Primary, secondary, and ghost button variants with loading states.

```tsx
import { Button } from '@/components/ui';

<Button variant="primary" size="md" isLoading={false}>
  Click me
</Button>
```

**Props:**
- `variant`: 'primary' | 'secondary' | 'ghost'
- `size`: 'sm' | 'md' | 'lg'
- `isLoading`: boolean

### Input
Text input with validation states (default, error, success).

```tsx
import { Input } from '@/components/ui';

<Input
  label="Email"
  placeholder="Enter email..."
  state="default"
  error="Invalid email"
/>
```

**Props:**
- `label`: string
- `state`: 'default' | 'error' | 'success'
- `error`: string
- `success`: string

### Card
Container with glass morphism styling and hover effects.

```tsx
import { Card } from '@/components/ui';

<Card hover={true} glass={true}>
  Card content
</Card>
```

**Props:**
- `hover`: boolean - Enable hover animation
- `glass`: boolean - Use glass morphism styling

### Modal
Dialog with backdrop blur and smooth animations.

```tsx
import { Modal } from '@/components/ui';

<Modal
  open={isOpen}
  onOpenChange={setIsOpen}
  title="Modal Title"
  description="Modal description"
>
  Modal content
</Modal>
```

**Props:**
- `open`: boolean
- `onOpenChange`: (open: boolean) => void
- `title`: string
- `description`: string
- `showClose`: boolean

### Dropdown
Dropdown menu with expand/collapse animations.

```tsx
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui';

<Dropdown trigger={<Button>Menu</Button>}>
  <DropdownItem onSelect={() => {}}>Edit</DropdownItem>
  <DropdownSeparator />
  <DropdownItem onSelect={() => {}}>Delete</DropdownItem>
</Dropdown>
```

### Tabs
Tab navigation with sliding indicator animation.

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';

<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>
```

### Badge
Status indicator badges.

```tsx
import { Badge } from '@/components/ui';

<Badge variant="success" size="md">
  Active
</Badge>
```

**Props:**
- `variant`: 'default' | 'success' | 'warning' | 'error' | 'info'
- `size`: 'sm' | 'md' | 'lg'

### Tooltip
Tooltip with fade-in animation.

```tsx
import { Tooltip } from '@/components/ui';

<Tooltip content="Tooltip text" side="top">
  <Button>Hover me</Button>
</Tooltip>
```

**Props:**
- `content`: ReactNode
- `side`: 'top' | 'right' | 'bottom' | 'left'
- `align`: 'start' | 'center' | 'end'
- `delayDuration`: number

### Progress
Progress bar for loading and execution tracking.

```tsx
import { Progress } from '@/components/ui';

<Progress value={75} max={100} showLabel variant="default" />
```

**Props:**
- `value`: number
- `max`: number
- `showLabel`: boolean
- `size`: 'sm' | 'md' | 'lg'
- `variant`: 'default' | 'success' | 'warning' | 'error'

### Skeleton
Loading skeleton with shimmer animation.

```tsx
import { Skeleton, SkeletonText, SkeletonCard } from '@/components/ui';

<Skeleton variant="rectangular" width={200} height={100} />
<SkeletonText lines={3} />
<SkeletonCard />
```

**Props:**
- `variant`: 'text' | 'circular' | 'rectangular'
- `width`: string | number
- `height`: string | number
- `animation`: 'pulse' | 'wave' | 'none'

## Design Tokens

All components use design tokens from `frontend/src/styles/design-tokens.ts`:

- Colors (light/dark mode)
- Typography scale
- Spacing system
- Border radius
- Shadows
- Animations

## Dark Mode

All components support dark mode via Tailwind's `dark:` classes. Dark mode is automatically applied based on system preferences or user selection.

## Accessibility

All components follow WCAG 2.1 Level AA guidelines:

- Keyboard navigation support
- ARIA labels and attributes
- Focus indicators
- Minimum touch target sizes (44px x 44px)
- Color contrast ratios

## Testing

Components can be tested using the demo file:

```tsx
import { UIDemo } from '@/components/ui/demo';

<UIDemo />
```

## Dependencies

- React 19+
- Framer Motion 12+
- Radix UI primitives
- Tailwind CSS 4
- TypeScript 5+
