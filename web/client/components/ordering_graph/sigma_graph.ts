import Graph from "graphology";
import Sigma from "sigma";
import data from "./data2.json";
import { NodeProgramSquare } from "./node.square";
import { Coordinates, EdgeDisplayData, NodeDisplayData } from "sigma/types";
import _ from "lodash";
import { getSystemErrorMap } from "util";

interface State {
  hoveredNode?: string;
  searchQuery: string;
  // State derived from query:

  selectedNode?: string;
  suggestions?: Set<string>;

  // State derived from hovered node:
  hoveredNeighbors?: Set<string>;
}

export class SigmaGraphCreator implements State {
  //the ordering graph html
  rootelement;
  //the div element, where the graph will be
  sigmaContainer;
  //the div element for the search window
  searchWindowContainer;
  searchWindowInputContainer;
  searchWindowDatalist: HTMLDataListElement;
  //the canvas elements which make up the graph
  graph;
  renderer;

  //state variables
  state: State;
  hoveredNode?: string | undefined;
  searchQuery: string;
  selectedNode?: string | undefined;
  suggestions?: Set<string> | undefined;
  hoveredNeighbors?: Set<string> | undefined;

  constructor(rootelement: HTMLElement) {
    //graph
    this.state = { searchQuery: "" };
    this.rootelement = rootelement;

    this.sigmaContainer = rootelement.querySelector(
      "#sigma-container"
    ) as HTMLElement;
    this.searchWindowInputContainer = rootelement.querySelector(
      "#search-input"
    ) as HTMLInputElement;
    this.searchWindowDatalist = rootelement.querySelector(
      "#suggestions"
    ) as HTMLDataListElement;
  }

  // Actions:
  private setSearchQuery(query: string) {
    this.state.searchQuery = query;

    if (this.searchWindowInputContainer.value !== query)
      this.searchWindowInputContainer.value = query;

    if (query) {
      const lcQuery = query.toLowerCase();
      var suggestions = this.graph
        .nodes()
        .map((n) => ({
          id: n,
          label: this.graph.getNodeAttribute(n, "label") as string,
        }))
        .filter(({ label }) => label.toLowerCase().includes(lcQuery));
      // If we have a single perfect match, them we remove the suggestions, and
      // we consider the user has selected a node through the datalist
      // autocomplete:
      if (suggestions[0].label === query) {
        this.state.selectedNode = suggestions[0].id;
        this.state.suggestions = undefined;

        // Move the camera to center it on the selected node:
        const nodePosition = this.renderer.getNodeDisplayData(
          this.state.selectedNode
        ) as Coordinates;
        this.renderer.getCamera().animate(nodePosition, {
          duration: 500,
        });
      }
      // Else, we display the suggestions list:
      else {
        this.state.selectedNode = undefined;
        this.state.suggestions = new Set(suggestions.map(({ id }) => id));
      }
    }
    // If the query is empty, then we reset the selectedNode / suggestions state:
    else {
      this.state.selectedNode = undefined;
      this.state.suggestions = undefined;
    }
    // Refresh rendering:
    this.renderer.refresh();
  }
  private setHoveredNode(node?: string) {
    if (node) {
      this.state.hoveredNode = node;
      const nodeTrainID = this.graph.getNodeAttribute(node, "train_id");
      this.state.hoveredNeighbors = this.filterNodesForGivenTarget(node);
    } else {
      this.state.hoveredNode = undefined;
      this.state.hoveredNeighbors = undefined;
    }

    // Refresh rendering:
    this.renderer.refresh();
  }

  //determines which other trains are linked directly to the given node's train id
  //and returns a set of the filtered nodes
  private filterNodesForGivenTarget(node?: string) {
    const nodeTrainID: string = this.graph.getNodeAttribute(node, "train_id");
    let filteredNodes = new Set<string>();
    filteredNodes.add(nodeTrainID);

    this.graph.mapEdges((edge) => {
      const train_id_source = this.graph.getEdgeAttribute(
        edge,
        "train_id_source"
      );
      const train_id_target = this.graph.getEdgeAttribute(
        edge,
        "train_id_target"
      );

      if (train_id_source === nodeTrainID) {
        filteredNodes.add(train_id_target);
      } else if (train_id_target === nodeTrainID) {
        filteredNodes.add(train_id_source);
      }
    });
    return (filteredNodes = new Set<string>(
      this.graph.filterNodes((node) =>
        filteredNodes.has(this.graph.getNodeAttribute(node, "train_id"))
      )
    ));
  }

  public createSigmaGraph() {
    this.graph = new Graph();
    this.graph.import(data);
    var trainIdDummy;
    var nodeXValue = 0;

    //nodes
    this.graph.forEachNode((node, i) => {
      let currrentTrainId = this.graph.getNodeAttribute(node, "train_id");
      if (trainIdDummy === currrentTrainId) {
        nodeXValue++;
      } else {
        trainIdDummy = currrentTrainId;
        nodeXValue = 0;
      }
      //coordinates of each node
      this.graph
        .setNodeAttribute(node, "x", nodeXValue / 2)
        .setNodeAttribute(node, "y", currrentTrainId / 2);

      //style elements
      let labelName = "Train:" + currrentTrainId;

      this.graph
        .mergeNodeAttributes(node, { label: labelName })
        .setNodeAttribute(node, "color", "#000000")
        .setNodeAttribute(node, "type", "square");
    });

    //edges
    this.graph.forEachEdge((edge) => {
      //this adds the train_id for both nodes of the edge
      const train_id_source = this.graph.findNode(
        (node) => node === this.graph.source(edge)
      );
      const train_id_target = this.graph.findNode(
        (node) => node === this.graph.target(edge)
      );

      //style elements
      this.graph
        .setEdgeAttribute(edge, "type", "arrow")
        .setEdgeAttribute(
          edge,
          "train_id_source",
          this.graph.getNodeAttribute(train_id_source, "train_id")
        )
        .setEdgeAttribute(
          edge,
          "train_id_target",
          this.graph.getNodeAttribute(train_id_target, "train_id")
        )
        .setEdgeAttribute(edge, "size", "3");
    });

    this.renderer = new Sigma(this.graph, this.sigmaContainer, {
      allowInvalidContainer: true,
      nodeProgramClasses: {
        square: NodeProgramSquare,
      },
      renderEdgeLabels: true,
    });

    //get all nodes due to lable and remove duplicate nodes from suggestions dropDownList
    var uniqNodesList = this.graph
      .nodes()
      .map((node) => this.graph.getNodeAttribute(node, "label"));

    //iterate over all nodes in the graph and remove duplicates
    var lastNode = uniqNodesList[0];
    var curr = 1;
    while (curr < uniqNodesList.length) {
      //check iflast node is the same as current node and rmove it
      if (uniqNodesList[curr] === lastNode) uniqNodesList.splice(curr, 1);
      //set new node as lastNode to check with next nodes
      else lastNode = uniqNodesList[curr++];
    }
    //display the nodeslist
    this.searchWindowDatalist.innerHTML = uniqNodesList
      .map((node) => `<option value="${node}"></option>`)
      .join("\n");
    // Bind search input interactions:
    this.searchWindowInputContainer.addEventListener("input", () => {
      this.setSearchQuery(this.searchWindowInputContainer.value || "");
    });
    this.searchWindowInputContainer.addEventListener("blur", () => {
      this.setSearchQuery("");
    });

    // Bind graph interactions:
    this.renderer.on("enterNode", ({ node }) => {
      this.setHoveredNode(node);
    });
    this.renderer.on("leaveNode", () => {
      this.setHoveredNode(undefined);
    });

    // Render nodes accordingly to the internal state:
    // 1. If a node is selected, it is highlighted
    // 2. If there is query, all non-matching nodes are greyed
    // 3. If there is a hovered node, all non-neighbor nodes are greyed
    this.renderer.setSetting("nodeReducer", (node, data) => {
      const res: Partial<NodeDisplayData> = { ...data };

      if (
        this.state.hoveredNeighbors &&
        !this.state.hoveredNeighbors.has(node) &&
        this.state.hoveredNode !== node
      ) {
        res.label = "";
        res.color = "#f6f6f6";
      }

      if (this.state.selectedNode === node) {
        res.highlighted = true;
      } else if (this.state.suggestions && !this.state.suggestions.has(node)) {
        res.label = "";
        res.color = "#f6f6f6";
      }
      return res;
    });

    // Render edges accordingly to the internal state:
    // 1. If a node is hovered, the edge is hidden if it is not connected to the
    //    node
    // 2. If there is a query, the edge is only visible if it connects two
    //    suggestions
    this.renderer.setSetting("edgeReducer", (edge, data) => {
      const res: Partial<EdgeDisplayData> = { ...data };

      if (
        this.state.hoveredNode &&
        !this.graph.hasExtremity(edge, this.state.hoveredNode)
      ) {
        res.hidden = true;
      }

      if (
        this.state.suggestions &&
        (!this.state.suggestions.has(this.graph.source(edge)) ||
          !this.state.suggestions.has(this.graph.target(edge)))
      ) {
        res.hidden = true;
      }

      return res;
    });
  }

  public resizeSigmaGraph() {
    if (this.renderer !== undefined) {
      this.renderer.refresh();
    } else {
      console.log("graph doesn't exist!");
    }
  }

  //used to close the canvas to not run into errors when opening to many windows
  public destroySigmaGraph() {
    if (this.renderer !== undefined) {
      this.renderer.clear();
      this.renderer.kill();
      this.rootelement.removeChild(this.sigmaContainer);
    }
  }
}
