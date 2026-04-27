"use client";

import { cn } from "../lib/utils";
import { Tabs as BaseTabs } from "@base-ui-components/react/tabs";
import type { ComponentPropsWithoutRef } from "react";

function Root({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof BaseTabs.Root>) {
  return <BaseTabs.Root className={cn("flex flex-col", className)} {...rest} />;
}

function List({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof BaseTabs.List>) {
  return (
    <BaseTabs.List
      className={cn(
        "inline-flex h-9 w-fit items-center justify-center rounded bg-accent-brighter p-[3px] text-muted-foreground",
        className
      )}
      {...rest}
    />
  );
}

function Tab({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof BaseTabs.Tab>) {
  return (
    <BaseTabs.Tab
      className={cn(
        "inline-flex h-[calc(100%-1px)] cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2 py-1 font-medium text-muted-foreground text-sm",
        "transition-[background-color,border-color,color,box-shadow] duration-(--duration-quick) ease-(--ease-smooth)",
        "hover:text-foreground",
        "data-active:border-accent-foreground/10 data-active:bg-secondary-brightest data-active:text-foreground",
        "focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-2 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...rest}
    />
  );
}

function Panel({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof BaseTabs.Panel>) {
  return (
    <BaseTabs.Panel
      className={cn("focus-visible:outline-none", className)}
      {...rest}
    />
  );
}

function Indicator({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof BaseTabs.Indicator>) {
  return (
    <BaseTabs.Indicator
      className={cn(
        "absolute bottom-0 h-0.5 rounded-full bg-primary",
        "transition-[width,transform] duration-(--duration-quick) ease-(--ease-smooth)",
        "motion-reduce:transition-none",
        className
      )}
      {...rest}
    />
  );
}

export const Tabs = Object.assign(Root, {
  List,
  Tab,
  Panel,
  Indicator,
});
