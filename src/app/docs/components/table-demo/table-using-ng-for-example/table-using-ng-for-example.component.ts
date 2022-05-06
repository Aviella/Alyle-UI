import { lyl, StyleRenderer, ThemeVariables } from '@alyle/ui';
import { Component, ChangeDetectionStrategy } from '@angular/core';

export interface Star {
  position: number;
  name: string;
  radius: number;
  temperature: number;
}

const ELEMENT_DATA: Star[] = [
  { position: 1, name: 'UY Scuti', radius: 1708, temperature: 3365 },
  { position: 2, name: 'VY Canis Majoris', radius: 1420, temperature: 3490 },
  { position: 3, name: 'Mu Cephei', radius: 1260, temperature: 3690 },
  { position: 4, name: 'Betelgeuse', radius: 887, temperature: 3500 },
  { position: 5, name: 'Antares A', radius: 680, temperature: 3600 },
  { position: 6, name: 'Pistol Star', radius: 420, temperature: 11800 },
  { position: 7, name: 'Rigel', radius: 78.9, temperature: 11000 },
  { position: 8, name: 'Aldebaran', radius: 45.1, temperature: 3910 },
  { position: 9, name: 'Arcturus', radius: 25.4, temperature: 4286 },
  { position: 10, name: 'Pollux', radius: 9.06, temperature: 4586 },
  { position: 11, name: 'Sun', radius: 1, temperature: 5778 },
];

const STYLES = (_theme: ThemeVariables) => {
  return {
    root: lyl `{
      table {
        // Custom styles
      }
    }`
  };
};

@Component({
  selector: 'aui-table-using-ng-for-example',
  templateUrl: './table-using-ng-for-example.component.html',
  providers: [
    StyleRenderer
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TableUsingNgForExampleComponent {
  readonly classes = this.sRenderer.renderSheet(STYLES, 'root');
  columns = [
    {
      columnDef: 'position',
      header: 'No.',
      cell: (element: Star) => `${element.position}`,
    },
    {
      columnDef: 'name',
      header: 'Name',
      cell: (element: Star) => `${element.name}`,
    },
    {
      columnDef: 'radius',
      header: 'Radius R☉',
      cell: (element: Star) => `${element.radius}`,
    },
    {
      columnDef: 'temperature',
      header: 'Temperature',
      cell: (element: Star) => `${element.temperature}`,
    },
  ];
  dataSource = ELEMENT_DATA;
  displayedColumns = this.columns.map(c => c.columnDef);

  constructor(
    readonly sRenderer: StyleRenderer
  ) { }

}
