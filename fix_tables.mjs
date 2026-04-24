const fs = require('fs');

const path = 'src/components/ForecastView.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace uppercase tracking-widest in <th>
content = content.replace(/<th([^>]*?)uppercase tracking-widest([^>]*?)>/g, '<th$1tracking-tight text-center capitalize$2>');
content = content.replace(/<th([^>]*?)uppercase tracking-wider([^>]*?)>/g, '<th$1tracking-tight text-center capitalize$2>');
content = content.replace(/<th([^>]*?)uppercase([^>]*?)>/g, '<th$1text-center capitalize$2>');

// Same for some <td> with uppercase
content = content.replace(/<td([^>]*?)uppercase tracking-widest([^>]*?)>/g, '<td$1tracking-tight text-center capitalize$2>');
content = content.replace(/<td([^>]*?)uppercase([^>]*?)>/g, '<td$1text-center capitalize$2>');

// Replace text-left and text-right with text-center in <th> and <td>
content = content.replace(/<th([^>]*?)text-left([^>]*?)>/g, '<th$1text-center$2>');
content = content.replace(/<th([^>]*?)text-right([^>]*?)>/g, '<th$1text-center$2>');
content = content.replace(/<td([^>]*?)text-left([^>]*?)>/g, '<td$1text-center$2>');
content = content.replace(/<td([^>]*?)text-right([^>]*?)>/g, '<td$1text-center$2>');

// Replace some fixed texts
content = content.replace(/" TOTAL "/g, '" Total "');
content = content.replace(/" TOTAL"/g, '" Total"');
content = content.replace(/"TOTAL "/g, '"Total "');
content = content.replace(/>TOTAL</g, '>Total<');
content = content.replace(/>TOTAL FTE</g, '>Total FTE<');
content = content.replace(/>AVG AHT</g, '>Avg AHT<');
content = content.replace(/>AGENTS</g, '>Agents<');
content = content.replace(/"TOTAL\b"/g, '"Total"');

fs.writeFileSync(path, content, 'utf8');
console.log("Done");
