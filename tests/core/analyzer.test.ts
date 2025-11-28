import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  analyzeDependencies,
  analyzeExports,
  analyzeReactComponent,
  DependencyAnalyzer,
  buildDependencyGraph
} from '@/core/analyzer.js';

describe('Analyzer', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsi-analyzer-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('analyzeDependencies', () => {
    it('should detect internal imports', () => {
      const testFile = path.join(tempDir, 'test.ts');
      fs.writeFileSync(testFile, `
import { foo } from './utils.js';
import { bar } from '../lib/helpers.js';
`);

      const deps = analyzeDependencies(testFile);

      // The analyzer returns full resolved paths from temp dir, check they contain the module names
      expect(deps.internal.some(d => d.includes('utils'))).toBe(true);
      expect(deps.internal.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect external imports', () => {
      const testFile = path.join(tempDir, 'test.ts');
      fs.writeFileSync(testFile, `
import fs from 'fs';
import path from 'path';
import { Client } from '@anthropic-ai/sdk';
`);

      const deps = analyzeDependencies(testFile);

      expect(deps.external).toContain('fs');
      expect(deps.external).toContain('path');
      expect(deps.external).toContain('@anthropic-ai/sdk');
    });

    it('should detect type-only imports', () => {
      const testFile = path.join(tempDir, 'test.ts');
      fs.writeFileSync(testFile, `
import type { SomeType } from './types.js';
import { realImport } from './utils.js';
`);

      const deps = analyzeDependencies(testFile);

      expect(deps.types.some(d => d.includes('types'))).toBe(true);
      expect(deps.internal.some(d => d.includes('utils'))).toBe(true);
    });

    it('should handle dynamic imports', () => {
      const testFile = path.join(tempDir, 'test.ts');
      fs.writeFileSync(testFile, `
const module = await import('./dynamic.js');
`);

      const deps = analyzeDependencies(testFile);

      expect(deps.internal.some(d => d.includes('dynamic'))).toBe(true);
    });

    it('should return empty arrays for file with no imports', () => {
      const testFile = path.join(tempDir, 'test.ts');
      fs.writeFileSync(testFile, 'const x = 1;');

      const deps = analyzeDependencies(testFile);

      expect(deps.internal).toEqual([]);
      expect(deps.external).toEqual([]);
      expect(deps.types).toEqual([]);
    });

    it('should not duplicate external packages', () => {
      const testFile = path.join(tempDir, 'test.ts');
      fs.writeFileSync(testFile, `
import fs from 'fs';
import { readFile } from 'fs';
import { writeFile } from 'fs/promises';
`);

      const deps = analyzeDependencies(testFile);

      expect(deps.external.filter(d => d === 'fs').length).toBe(1);
    });
  });

  describe('analyzeExports', () => {
    it('should detect exported classes', () => {
      const testFile = path.join(tempDir, 'test.ts');
      fs.writeFileSync(testFile, `
export class MyClass {}
export class AnotherClass {}
`);

      const exports = analyzeExports(testFile);

      expect(exports).toContainEqual({ name: 'MyClass', kind: 'class' });
      expect(exports).toContainEqual({ name: 'AnotherClass', kind: 'class' });
    });

    it('should detect exported functions', () => {
      const testFile = path.join(tempDir, 'test.ts');
      fs.writeFileSync(testFile, `
export function myFunction() {}
export async function asyncFunc() {}
`);

      const exports = analyzeExports(testFile);

      expect(exports).toContainEqual({ name: 'myFunction', kind: 'function' });
      expect(exports).toContainEqual({ name: 'asyncFunc', kind: 'function' });
    });

    it('should detect exported constants', () => {
      const testFile = path.join(tempDir, 'test.ts');
      fs.writeFileSync(testFile, `
export const MY_CONST = 'value';
export const config = { port: 3000 };
`);

      const exports = analyzeExports(testFile);

      expect(exports).toContainEqual({ name: 'MY_CONST', kind: 'const' });
      expect(exports).toContainEqual({ name: 'config', kind: 'const' });
    });

    it('should detect exported interfaces and types', () => {
      const testFile = path.join(tempDir, 'test.ts');
      fs.writeFileSync(testFile, `
export interface MyInterface {}
export type MyType = string;
`);

      const exports = analyzeExports(testFile);

      expect(exports).toContainEqual({ name: 'MyInterface', kind: 'interface' });
      expect(exports).toContainEqual({ name: 'MyType', kind: 'type' });
    });

    it('should exclude __metadata from exports', () => {
      const testFile = path.join(tempDir, 'test.ts');
      fs.writeFileSync(testFile, `
export const __metadata = {};
export const realExport = 'value';
`);

      const exports = analyzeExports(testFile);

      expect(exports.find(e => e.name === '__metadata')).toBeUndefined();
      expect(exports).toContainEqual({ name: 'realExport', kind: 'const' });
    });
  });

  describe('DependencyAnalyzer', () => {
    it('should build dependency graph', async () => {
      // Create a mini project structure
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir);
      fs.writeFileSync(path.join(srcDir, 'index.ts'), `
import { helper } from './utils.js';
`);
      fs.writeFileSync(path.join(srcDir, 'utils.ts'), `
export function helper() {}
`);

      const analyzer = new DependencyAnalyzer(srcDir);
      await analyzer.analyze();

      const indexUsage = analyzer.getUses('index');
      expect(indexUsage).toContain('utils');

      const utilsUsedBy = analyzer.getUsedBy('utils');
      expect(utilsUsedBy).toContain('index');
    });

    it('should find unused modules', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir);
      fs.writeFileSync(path.join(srcDir, 'main.ts'), 'export const main = 1;');
      fs.writeFileSync(path.join(srcDir, 'unused.ts'), 'export const unused = 2;');

      const analyzer = new DependencyAnalyzer(srcDir);
      await analyzer.analyze();

      const unused = analyzer.getUnusedModules();
      expect(unused).toContain('main');
      expect(unused).toContain('unused');
    });

    it('should detect circular dependencies', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir);
      fs.writeFileSync(path.join(srcDir, 'a.ts'), "import { b } from './b.js';");
      fs.writeFileSync(path.join(srcDir, 'b.ts'), "import { a } from './a.js';");

      const analyzer = new DependencyAnalyzer(srcDir);
      await analyzer.analyze();

      const cycles = analyzer.findCircularDependencies();
      expect(cycles.length).toBeGreaterThan(0);
    });
  });

  describe('buildDependencyGraph', () => {
    it('should build complete graph', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir);
      fs.writeFileSync(path.join(srcDir, 'a.ts'), "import { b } from './b.js';");
      fs.writeFileSync(path.join(srcDir, 'b.ts'), 'export const b = 1;');

      const graph = await buildDependencyGraph(srcDir);

      expect(graph.has('a')).toBe(true);
      expect(graph.has('b')).toBe(true);
      expect(graph.get('a')?.uses).toContain('b');
      expect(graph.get('b')?.usedBy).toContain('a');
    });
  });

  describe('analyzeReactComponent', () => {
    it('should return null for non-tsx files', () => {
      const testFile = path.join(tempDir, 'test.ts');
      fs.writeFileSync(testFile, 'export const x = 1;');

      const result = analyzeReactComponent(testFile);
      expect(result).toBeNull();
    });

    it('should detect hooks usage', () => {
      const testFile = path.join(tempDir, 'Component.tsx');
      fs.writeFileSync(testFile, `
import React, { useState, useEffect } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    console.log(count);
  }, [count]);

  return <div>{count}</div>;
}
`);

      const result = analyzeReactComponent(testFile);
      
      expect(result).not.toBeNull();
      expect(result?.hooks).toBeDefined();
      expect(result?.hooks?.some(h => h.name === 'useState' && !h.isCustom)).toBe(true);
      expect(result?.hooks?.some(h => h.name === 'useEffect' && !h.isCustom)).toBe(true);
    });

    it('should detect custom hooks', () => {
      const testFile = path.join(tempDir, 'Component.tsx');
      fs.writeFileSync(testFile, `
import React from 'react';
import { useCustomHook } from './hooks';

export function MyComponent() {
  const data = useCustomHook();
  return <div>{data}</div>;
}
`);

      const result = analyzeReactComponent(testFile);
      
      expect(result).not.toBeNull();
      expect(result?.hooks?.some(h => h.name === 'useCustomHook' && h.isCustom)).toBe(true);
    });

    it('should detect props interface', () => {
      const testFile = path.join(tempDir, 'Button.tsx');
      fs.writeFileSync(testFile, `
import React from 'react';

export interface ButtonProps {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled }: ButtonProps) {
  return <button onClick={onClick} disabled={disabled}>{label}</button>;
}
`);

      const result = analyzeReactComponent(testFile);
      
      expect(result).not.toBeNull();
      expect(result?.props?.interfaceName).toBe('ButtonProps');
      expect(result?.props?.properties).toBeDefined();
      expect(result?.props?.properties?.some(p => p.name === 'label' && p.required)).toBe(true);
      expect(result?.props?.properties?.some(p => p.name === 'onClick' && !p.required)).toBe(true);
    });

    it('should detect child components rendered', () => {
      const testFile = path.join(tempDir, 'Parent.tsx');
      fs.writeFileSync(testFile, `
import React from 'react';
import { Avatar } from './Avatar';
import { Badge } from './Badge';

export function UserCard() {
  return (
    <div>
      <Avatar src="test.jpg" />
      <Badge status="active" />
    </div>
  );
}
`);

      const result = analyzeReactComponent(testFile);
      
      expect(result).not.toBeNull();
      expect(result?.renders).toContain('Avatar');
      expect(result?.renders).toContain('Badge');
    });

    it('should detect memo usage', () => {
      const testFile = path.join(tempDir, 'MemoComponent.tsx');
      fs.writeFileSync(testFile, `
import React, { memo } from 'react';

export const MyComponent = memo(function MyComponent() {
  return <div>Hello</div>;
});
`);

      const result = analyzeReactComponent(testFile);
      
      expect(result).not.toBeNull();
      expect(result?.memoized).toBe(true);
    });

    it('should detect forwardRef usage', () => {
      const testFile = path.join(tempDir, 'InputComponent.tsx');
      fs.writeFileSync(testFile, `
import React, { forwardRef } from 'react';

export const Input = forwardRef<HTMLInputElement, { placeholder?: string }>(
  ({ placeholder }, ref) => {
    return <input ref={ref} placeholder={placeholder} />;
  }
);
`);

      const result = analyzeReactComponent(testFile);
      
      expect(result).not.toBeNull();
      expect(result?.forwardRef).toBe(true);
    });

    it('should detect useContext and context name', () => {
      const testFile = path.join(tempDir, 'ThemedComponent.tsx');
      fs.writeFileSync(testFile, `
import React, { useContext } from 'react';
import { ThemeContext } from './contexts';

export function ThemedButton() {
  const theme = useContext(ThemeContext);
  return <button style={{ color: theme.primary }}>Click</button>;
}
`);

      const result = analyzeReactComponent(testFile);
      
      expect(result).not.toBeNull();
      expect(result?.contexts).toContain('ThemeContext');
    });

    it('should detect state management (redux)', () => {
      const testFile = path.join(tempDir, 'ReduxComponent.tsx');
      fs.writeFileSync(testFile, `
import React from 'react';
import { useSelector, useDispatch } from 'react-redux';

export function Counter() {
  const count = useSelector(state => state.count);
  const dispatch = useDispatch();
  return <div>{count}</div>;
}
`);

      const result = analyzeReactComponent(testFile);
      
      expect(result).not.toBeNull();
      expect(result?.stateManagement).toContain('redux');
    });

    it('should detect component type from path', () => {
      const pagesDir = path.join(tempDir, 'pages');
      fs.mkdirSync(pagesDir);
      const testFile = path.join(pagesDir, 'HomePage.tsx');
      fs.writeFileSync(testFile, `
import React from 'react';

export function HomePage() {
  return <div>Home</div>;
}
`);

      const result = analyzeReactComponent(testFile);
      
      expect(result).not.toBeNull();
      expect(result?.componentType).toBe('page');
    });

    it('should detect FC pattern with props', () => {
      const testFile = path.join(tempDir, 'FCComponent.tsx');
      fs.writeFileSync(testFile, `
import React, { FC } from 'react';

interface CardProps {
  title: string;
  content: string;
}

export const Card: FC<CardProps> = ({ title, content }) => {
  return (
    <div>
      <h1>{title}</h1>
      <p>{content}</p>
    </div>
  );
};
`);

      const result = analyzeReactComponent(testFile);
      
      expect(result).not.toBeNull();
      expect(result?.props?.interfaceName).toBe('CardProps');
    });
  });
});

