export default async function* exportInfoFromReadme(iterator) {
  const handleLine = /^\* \[([^\]]+)\]\(/;
  const nameAndEmailLine = /^\s\s\*\*([^*]+)\*\* <<([^>]+)>>(?: \([^)]+\))?$/;
  let isInsideTSCSection = false;
  let isInsideCollaboratorsSection = false;
  let currentMemberHandle;
  for await (const line of iterator) {
    if (currentMemberHandle != null) {
      const [, name, email] = nameAndEmailLine.exec(line);
      yield {
        handle: currentMemberHandle,
        name,
        email,
        isTSC: isInsideCollaboratorsSection,
      };
      currentMemberHandle = null;
    } else if (isInsideTSCSection && line === "#### TSC regular members") {
      isInsideTSCSection = false;
    } else if (isInsideCollaboratorsSection && line === "<details>") {
      isInsideCollaboratorsSection = false;
      // Nothing left to parse in that file
      break;
    } else if (
      (isInsideTSCSection || isInsideCollaboratorsSection) &&
      line.charAt(0) === "*"
    ) {
      currentMemberHandle = handleLine.exec(line)[1];
    } else if (line === "### Collaborators") {
      isInsideCollaboratorsSection = true;
    } else if (line === "#### TSC voting members") {
      isInsideTSCSection = true;
    }
  }
}
