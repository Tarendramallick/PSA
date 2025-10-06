"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import * as React from "react"

export function SiteHeader() {
  const [open, setOpen] = React.useState(false)

  return (
    <header className="flex items-center justify-between py-4">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-sm bg-primary/20 grid place-items-center">
          <span className="text-[10px] font-mono">J</span>
        </div>
        <span className="text-sm font-medium text-pretty">Java Typing Practice</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          About
        </Button>
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-w-3xl w-[92vw] rounded-lg border border-border bg-card p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">About this app</h2>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Practice typing Java code snippets parsed from your lecture notes. Snippets marked with error outputs are
              automatically excluded.
            </p>
            <div className="mt-3 rounded-md overflow-hidden border border-border">
              <Image
                src="/images/speedtyper-reference.png"
                alt="Reference interface screenshot"
                width={1483}
                height={768}
                className="w-full h-auto"
                priority
              />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  )
}
