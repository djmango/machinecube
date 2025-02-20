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

export const MachineSchema = {
  name: "string",
  components: [{
    name: "string",
    type: "component",
    hasChildren: true
  }]
} as const; 
