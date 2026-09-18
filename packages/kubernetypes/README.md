# `kubernetypes`

![NPM Version](https://img.shields.io/npm/v/kubernetypes)
![NPM License](https://img.shields.io/npm/l/kubernetypes)

TypeScript types for core Kubernetes APIs.

## Installation

For latest Kubernetes version:

```shell
npm install kubernetypes
```

For specific Kubernetes version:

```shell
npm install kubernetypes@<k8s version>
```

## Usage

```typescript
import type { Pod } from 'kubernetypes/api/core/v1';

export default {
  apiVersion: 'v1',
  kind: 'Pod',
  metadata: {
    name: 'foobar',
  },
  spec: {
    containers: [
      {
        name: 'app',
        image: 'alpine:latest',
        /* ... */
      },
    ],
  },
} satisfies Pod;
```

## License

MIT
