import React from "react";
import { Button, Tooltip } from "@material-ui/core";
import { IMethodPluginProps } from "@open-rpc/docs-react/build/Methods/Methods";
import searchBarStore from "../stores/searchBarStore";
import { ExamplePairingObject, ExampleObject } from "@open-rpc/meta-schema";
import useInspectorActionStore from "../stores/inspectorActionStore";

export type TParamStructure = "either" | "by-name" | "by-position";

const InspectorPlugin: React.FC<IMethodPluginProps> = (props) => {
  const [searchUrl] = searchBarStore();
  const [, setInspectorContents] = useInspectorActionStore();
  const method = props.openrpcMethodObject;
  const examplePosition = 0;
  let example;
  let exampleParams: any;
  if (method && method.examples && method.examples[examplePosition]) {
    example = method.examples[examplePosition] as ExamplePairingObject;
    const paramStructure: TParamStructure = method.paramStructure || "either";
    exampleParams = paramStructure === "by-name"
      ? (example.params as ExampleObject[]).reduce(((memo, p) => {
        memo[p.name] = p.value;
        return memo;
      }), {} as any)
      : (example.params as ExampleObject[]).map(((p) => p.value));
  }
  return (
    <Tooltip title="Open in Inspector">
      <Button variant="contained" onClick={() => setInspectorContents({
        url: searchUrl,
        openrpcMethodObject: props.openrpcMethodObject,
        request: {
          jsonrpc: "2.0",
          method: method.name,
          params: exampleParams || [],
          id: 0,
        },
      })}><span role="img" aria-label="try-it-inspector">🕵️‍♂️</span>️️ Try It Now</Button>

    </Tooltip>
  );
};

export default InspectorPlugin;


