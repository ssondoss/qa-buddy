import { Component } from '@angular/core';

@Component({
  selector: 'app-portfolio-footer',
  standalone: true,
  templateUrl: './portfolio-footer.component.html',
  styleUrl: './portfolio-footer.component.scss',
})
export class PortfolioFooterComponent {
  readonly currentYear = new Date().getFullYear();
  readonly portfolioUrl = 'https://ssondoss.github.io/me/';
}
