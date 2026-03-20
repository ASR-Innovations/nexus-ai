'use client';

/**
 * UI Component Library Demo
 * 
 * This file demonstrates all the base UI components.
 * It can be used for testing and showcasing the component library.
 */

import { useState } from 'react';
import {
  Button,
  Input,
  Card,
  Modal,
  Dropdown,
  DropdownItem,
  DropdownSeparator,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
  Tooltip,
  Progress,
  Skeleton,
  SkeletonText,
  SkeletonCard,
} from './index';

export function UIDemo() {
  const [modalOpen, setModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [progress, setProgress] = useState(45);

  return (
    <div className="p-8 space-y-12 max-w-6xl mx-auto">
      <section>
        <h2 className="text-h2 mb-4">Buttons</h2>
        <div className="flex flex-wrap gap-4">
          <Button variant="primary">Primary Button</Button>
          <Button variant="secondary">Secondary Button</Button>
          <Button variant="ghost">Ghost Button</Button>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" size="lg">Large</Button>
          <Button variant="primary" isLoading>Loading</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
      </section>

      <section>
        <h2 className="text-h2 mb-4">Inputs</h2>
        <div className="space-y-4 max-w-md">
          <Input
            label="Default Input"
            placeholder="Enter text..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <Input
            label="Error State"
            placeholder="Enter text..."
            state="error"
            error="This field is required"
          />
          <Input
            label="Success State"
            placeholder="Enter text..."
            state="success"
            success="Looks good!"
          />
          <Input label="Disabled" placeholder="Disabled input" disabled />
        </div>
      </section>

      <section>
        <h2 className="text-h2 mb-4">Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <h3 className="text-h4 mb-2">Glass Morphism Card</h3>
            <p className="text-body-md text-light-textSecondary dark:text-dark-textSecondary">
              This card uses glass morphism styling with backdrop blur.
            </p>
          </Card>
          <Card glass={false}>
            <h3 className="text-h4 mb-2">Solid Card</h3>
            <p className="text-body-md text-light-textSecondary dark:text-dark-textSecondary">
              This card uses solid background without glass effect.
            </p>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="text-h2 mb-4">Modal</h2>
        <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
        <Modal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title="Example Modal"
          description="This is a modal with backdrop blur and smooth animations."
        >
          <div className="space-y-4">
            <p className="text-body-md">Modal content goes here.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setModalOpen(false)}>Confirm</Button>
            </div>
          </div>
        </Modal>
      </section>

      <section>
        <h2 className="text-h2 mb-4">Dropdown</h2>
        <Dropdown trigger={<Button variant="secondary">Open Menu</Button>}>
          <DropdownItem onSelect={() => console.log('Edit')}>Edit</DropdownItem>
          <DropdownItem onSelect={() => console.log('Duplicate')}>Duplicate</DropdownItem>
          <DropdownSeparator />
          <DropdownItem onSelect={() => console.log('Delete')}>Delete</DropdownItem>
        </Dropdown>
      </section>

      <section>
        <h2 className="text-h2 mb-4">Tabs</h2>
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">
            <Card>Content for Tab 1</Card>
          </TabsContent>
          <TabsContent value="tab2">
            <Card>Content for Tab 2</Card>
          </TabsContent>
          <TabsContent value="tab3">
            <Card>Content for Tab 3</Card>
          </TabsContent>
        </Tabs>
      </section>

      <section>
        <h2 className="text-h2 mb-4">Badges</h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant="default">Default</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="error">Error</Badge>
          <Badge variant="info">Info</Badge>
          <Badge size="sm">Small</Badge>
          <Badge size="lg">Large</Badge>
        </div>
      </section>

      <section>
        <h2 className="text-h2 mb-4">Tooltips</h2>
        <div className="flex gap-4">
          <Tooltip content="This is a tooltip">
            <Button variant="secondary">Hover me</Button>
          </Tooltip>
          <Tooltip content="Tooltip on the right" side="right">
            <Button variant="secondary">Right tooltip</Button>
          </Tooltip>
        </div>
      </section>

      <section>
        <h2 className="text-h2 mb-4">Progress</h2>
        <div className="space-y-4 max-w-md">
          <Progress value={progress} showLabel />
          <Progress value={75} variant="success" />
          <Progress value={50} variant="warning" />
          <Progress value={25} variant="error" />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setProgress(Math.max(0, progress - 10))}>
              -10%
            </Button>
            <Button size="sm" onClick={() => setProgress(Math.min(100, progress + 10))}>
              +10%
            </Button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-h2 mb-4">Skeletons</h2>
        <div className="space-y-4">
          <SkeletonText lines={3} />
          <SkeletonCard />
          <div className="flex gap-2">
            <Skeleton variant="circular" width={48} height={48} />
            <Skeleton variant="rectangular" width={200} height={48} />
          </div>
        </div>
      </section>
    </div>
  );
}
