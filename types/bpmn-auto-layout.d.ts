// bpmn-auto-layout ships no type declarations.
//
// Its current README describes a newer API that resolves to { xml, warnings }.
// The installed version, 1.3.0, resolves to the laid-out XML string itself, so
// that is what is declared here. Check this if the package is upgraded.
declare module "bpmn-auto-layout" {
  export function layoutProcess(xml: string): Promise<string>;
}
