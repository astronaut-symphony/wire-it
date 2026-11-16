import { createContext } from 'react';
import type { Component } from '@/shared/types';

// Own file for the same reason as menu.ts: keep the context identity stable across hot reloads.
export const Comps = createContext(new Map<string, Component>());
