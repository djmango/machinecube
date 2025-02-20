export interface Component {
  name: string;
  type: 'component' | 'material';
  hasChildren?: boolean; // Indicates if this node can be expanded
}

export interface Machine {
  name: string;
  components: Component[];
}

export interface MachineLookupResult {
  machine: Machine;
  timestamp: number;
}

export namespace Machine {
  export const schema = {
    name: "string",
    components: [{
      name: "string",
      type: "component",
      hasChildren: true
    }]
  } as const;
} 
