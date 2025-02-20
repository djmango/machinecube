export interface Component {
  name: string;
  description: string;
  imageUrl: string;
  requiredMachines: Machine[];
}

export interface Machine {
  name: string;
  imageUrl: string;
  description: string;
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
      process: "string",
      requiredMachines: ["string"]
    }]
  } as const;
} 
