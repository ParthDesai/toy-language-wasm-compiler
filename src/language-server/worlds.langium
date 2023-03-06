grammar Worlds

entry Main: (animals+=Animal | worlds+=World | instances+=Instance | transfer+=Transfer)* 'narrate';

Animal: 'Animal' name=ID sound=ID gene=ID; 
Instance: 'Instance' name=ID species=[Animal:ID];
World: 'World' name=ID 'contains' (contains+=[Instance:ID])*;
Transfer: 'Transfer' from=[World:ID] '.' animalToTransfer=[Instance:ID] 'to' to=[World:ID];

hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;